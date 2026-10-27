# Stripe — abonament Detailflow (#50)

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
obciążenia karty samodzielnie. Customer Portal, gating dostępu, cron i maile trialu
należą do #51. Sekrety nie trafiają do klienta. Publishable key nie jest potrzebny
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
