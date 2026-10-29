# Stripe — abonament Detailflow (#50, #51)

Stripe rozlicza studio za SaaS. Nie zapisuje faktur w modelu `Invoice` (KSeF).
Rejestracja `/start` nadal tworzy 14-dniowy trial bez klienta Stripe i bez karty.

## Konfiguracja

1. Ustaw `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` i `APP_URL` w środowisku web.
   Bez konfiguracji reszta aplikacji działa; billing zwraca komunikat o braku Stripe.
2. Uruchom `pnpm billing:setup` z kluczem testowym. Skrypt tworzy brakujące produkty
   i miesięczne ceny netto PLN: `plan_solo_monthly` (7900 gr),
   `plan_studio_monthly` (14900 gr), `plan_pro_monthly` (27900 gr).
   Ponowne uruchomienie weryfikuje istniejące ceny; nie podmienia błędnej ceny.
   Dla live wykonaj osobno z kluczem live. Nie ma planów rocznych.
3. Skonfiguruj Stripe Tax (adres sprzedawcy, rejestracje podatkowe i klasyfikację
   produktów SaaS). Ceny mają `tax_behavior=exclusive`; Checkout zbiera adres/NIP
   i oblicza podatek przez `automatic_tax`. Nie przeliczamy pieniędzy przez float.
4. W Workbench dodaj snapshot endpoint `POST /api/stripe/webhook`, API version
   `2026-09-30.endive` (zgodna z przypiętą wersją SDK) i zdarzenia:
   `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`,
   `customer.subscription.paused`, `customer.subscription.resumed`,
   `customer.subscription.pending_update_applied`,
   `customer.subscription.pending_update_expired`,
   `customer.subscription.trial_will_end`, `invoice.paid`, `invoice.payment_failed`.
   Lokalnie: `stripe listen --forward-to localhost:3000/api/stripe/webhook`;
   jego `whsec_…` ustaw jako sekret endpointu lokalnego.

## Przepływ

Właściciel otwiera „Abonament Detailflow” (`/billing`) w sidebarze lub menu
mobilnym. Aktywny trial pokazuje datę końca; serwer odrzuca próbę Checkout przed
jego końcem. Po trialu `POST /api/studios/:studioId/billing/checkout` z
`{ "plan": "solo" | "studio" | "pro" }` wymaga sesji, Origin aplikacji i roli owner.
Tworzy klienta Stripe dopiero teraz. Przypisanie `customerId` jest zapisane w Studio,
a `studioId` trafia do metadanych klienta, sesji i abonamentu.

Istniejąca otwarta sesja tego planu jest używana ponownie. Zmiana planu wygasza
poprzednią otwartą sesję. Istniejący nieterminalny abonament w Stripe uniemożliwia
utworzenie kolejnego, również przed otrzymaniem pierwszego webhooku. Powrót
success_url pokazuje wyłącznie komunikat; nie nadaje dostępu.

Webhook weryfikuje podpis SDK na `request.text()` (bez wcześniejszego JSON.parse).
`StripeEvent.id` już jest kluczem głównym w migracji fundamentu, więc nowa migracja
nie jest potrzebna. `createMany(skipDuplicates)` w transakcji razem z aktualizacją
Studio i AuditLog zapewnia idempotencję, także przy równoległym replay.
Błąd cofa transakcję, endpoint zwraca 500, Stripe ponawia dostarczenie.

Lock PostgreSQL per studio serializuje Checkout i webhooki. Webhook ponownie pobiera
bieżący abonament spod locka: opóźnione snapshoty nie cofają stanu. Weryfikuje
customerId i metadata.studioId, a starszy abonament nie zastępuje nowego.
Otwarte płatności ostatniej faktury z `invoice.payment_failed` dają `past_due`;
już opłacona lub historyczna faktura nie cofa aktualnego stanu.
`unpaid`/`paused`/`incomplete` → `suspended`, `canceled`/`incomplete_expired` → `canceled`.
`invoice.paid` synchronizuje bieżący stan i zapisuje kwotę w groszach jako string
w audycie. Operacje platformowe Studio/StripeEvent/AuditLog używają `platformDb`;
autoryzacja membershipów jest wymuszana przez `studioDb(studioId)`.

Stripe Smart Retries konfiguruje się w Stripe Billing; aplikacja nie ponawia
obciążenia karty samodzielnie. Sekrety nie trafiają do klienta. Publishable key nie jest potrzebny
przy przekierowaniu do hostowanego Checkout.

## Weryfikacja

`DATABASE_URL=<osobna baza testowa po migrate deploy> pnpm test src/server/billing/billing.test.ts src/server/studio/create.test.ts`

Testy używają prawdziwego Postgres i atrap transportu Stripe. Sprawdzają replay,
race, rollback/retry, izolację dwóch studiów, uprawnienia i CSRF, podpis i TTL,
Checkout po trialu oraz brak Stripe przy rejestracji. Przed uruchomieniem live
wykonaj pełny zakup kartą testową przez Checkout i resend z Workbench w sandboxie.
Źródła kontraktu: [webhooki](https://docs.stripe.com/webhooks),
[Checkout](https://docs.stripe.com/api/checkout/sessions/create),
[Invoice](https://docs.stripe.com/api/invoices/object).


## Customer Portal

W Stripe Dashboard → Settings → Billing → Customer portal skonfiguruj i zapisz
**domyślną konfigurację**, osobno w sandboxie i live. Włącz zmianę metody płatności,
podgląd faktur abonamentowych, anulowanie oraz zmianę planu. Do zmiany planu dopuść
wyłącznie trzy produkty i miesięczne ceny utworzone przez `pnpm billing:setup`
(Solo/Studio/Pro, PLN, bez zmiany ilości, bez planów rocznych). Wybierz anulowanie
na koniec okresu i proration zgodnie z polityką rozliczeń operatora. Stripe ustala
należności; aplikacja synchronizuje plan i status webhookiem. Anulowanie na koniec
okresu zachowuje `active` do faktycznego zakończenia subskrypcji.

`POST /api/studios/:studioId/billing/portal` wymaga sesji, Origin i roli owner.
Customer pochodzi wyłącznie z rekordu autoryzowanego studia; body nie wybiera
customer ani return URL. Portal wraca na `/billing`; powrót nie nadaje dostępu.
Właściciel może otworzyć portal również w stanie past_due/suspended/canceled,
np. w celu poprawienia karty lub pobrania faktur abonamentowych. Nowy abonament
po definitywnym anulowaniu kupuje przez istniejący Checkout.
Kontrakt: [Stripe Portal Session](https://docs.stripe.com/api/customer_portal/sessions/create).

## Tryb ograniczony

`active` i niewygasły `trial` pozwalają na zapis. `past_due`, `suspended`,
`canceled` i trial bez daty lub z datą `<= now` dają dostęp tylko do odczytu.
Nie ma dodatkowego grace period. Wygaśnięcie jest sprawdzane przy żądaniu;
nie zależy od wykonania crona ani ponownego logowania. Status wygasłego trialu
pozostaje `trial` (nie `suspended`), aby Checkout mógł go aktywować.

Logowanie nadal działa i layout studia pokazuje komunikat o przyczynie,
odczycie oraz link do rozliczeń dla właściciela. Każda mutacja operacyjnego API
(POST/PUT/PATCH/DELETE) dostaje 403, w tym nowe FV, korekty, oznaczanie płatności,
wyceny, zdjęcia, klienci i zlecenia. GET zachowuje zwykłe uprawnienia ról.
Zaproszenia z Server Action również sprawdzają blokadę. Przełączenie aktywnego
studia i zarządzanie billingiem pozostają dostępne; membership jest nadal wymagany.
Dane są zachowane. Publiczne odpowiedzi klientów i wcześniej przyjęte zadania
outbox/KSeF kończą swój obieg; ograniczenie dotyczy nowych zapisów personelu studia.

## Codzienny cron trialu

Istniejący proces `pnpm worker` / `pnpm worker:start` rejestruje trwały scheduler
BullMQ `billing-daily` o **06:00 Europe/Warsaw**, a przy starcie wykonuje catch-up.
Wymaga Redis, bazy po `pnpm db:deploy` i konfiguracji `SMTP_URL`, `APP_URL`,
opcjonalnie `EMAIL_FROM`. Bez SMTP/APP_URL wysyłka jest wyłączona.
Trzy dni przed końcem trialu wysyła mail PL do właściciela studia; po przestoju
nadrabia przypomnienie, jeśli trial jeszcze trwa. Nie wysyła do aktywnych ani
wygasłych kont. Sam cut-off jest natychmiastowy i sprawdzany w autoryzacji.

`Studio.trialReminderSentAt` i lock transakcyjny per studio chronią przed
równoległą wysyłką. Błąd SMTP wycofuje znacznik; BullMQ ponawia zadanie
(3 próby z exponential backoff). Kolejny cron także ponowi niewysłane wiadomości.
Message-ID jest stały dla studia i daty końca trialu. Jak przy pozostałych mailach
SMTP, awaria procesu po przyjęciu wiadomości przez SMTP, przed commitem bazy,
może spowodować powtórkę; SMTP nie zapewnia exactly-once.

## MRR

`calculateMrr` (`mrr.ts`) zwraca Decimal netto w PLN. Liczy wyłącznie `active`;
trial/past_due/suspended/canceled są wykluczone. Unit test odtwarza przykład audytu:
64 × 79 + 48 × 149 + 16 × 279 = 16 672 PLN. A-01 podłącza tę funkcję;
skład per plan, zaległości i churn są w A-04.

`invoice.paid` zapisuje też `SubscriptionPayment.amountNet` — netto z
`total_excluding_tax` (albo `subtotal`), nie z brutto `amount_paid`. To jest
metryka „Wpływy”. Faktura KSeF (`Invoice`) tam nie trafia.

Testy #51: `pnpm test src/server/billing src/server/acl.test.ts` na osobnej bazie
PostgreSQL po migracjach. Obejmują izolację tenantów, CSRF/role portalu, anulowanie
→ odczyt z komunikatem, blokadę zapisów, granicę trialu, MRR, deduplikację i retry maili.

## Abonament roczny (#147) — przygotowanie

Zakres jest autoryzowany decyzją właściciela z 29.10.2026; dawne „Poza v1”
nie oznacza braku zgody. Brak cen rocznych zatwierdzonych przez człowieka
w issue uniemożliwia aktywację. [Analiza i plan zmian](../../../docs/stripe-roczny-przygotowanie.md)
obejmują katalog, Checkout, webhook, projekcję okresu/ceny, MRR i landing.
Do decyzji cenowej provisioning, portal i oferta pozostają miesięczne.
