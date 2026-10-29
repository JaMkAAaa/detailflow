# #147 — przygotowanie abonamentu rocznego Detailflow

Stan: 29.10.2026. **Zakres autoryzowany, oferta czeka na zatwierdzone ceny.**
To analiza i plan wdrożenia, nie uruchomiony abonament roczny.

## Sprawdzone źródła i zależności

- [Pełne issue #147](https://github.com/JaMkAAaa/detailflow/issues/147): pierwsze
  kryterium wymaga kwot rocznych zatwierdzonych przez człowieka w tym issue.
  W chwili analizy brak komentarzy i brak tych kwot w treści.
- Przeszukano śledzone pliki repozytorium (`roczn`, `annual`, `yearly`,
  `lookup_key`), tytuły/treści issue o abonamencie rocznym oraz komentarze issue
  repozytorium. Nie znaleziono zatwierdzonej oferty rocznej. Historyczny komentarz
  w #115 wylicza moduły, ale nie podaje cen.
- `README.md` §1.6, specyfikacja §1 i §11, `lib/landing/plans.ts` oraz
  `src/server/billing/plans.ts` zawierają wyłącznie miesięczne ceny netto PLN:
  Solo 79, Studio 149, Pro 279. **Nie upoważnia to do przyjęcia 12× ani rabatu.**
- #110, #111 i #112 są CLOSED; API `issues/147/dependencies/blocked_by` zwróciło
  pustą listę. #146 jest CLOSED, PR #185 MERGED, baza analizy to `origin/main`
  `49e14d6449281a41fce0502202f0b12af93f0742`. Zamkniętych issue nie wznawiamy.
- Decyzja właściciela z 29.10.2026 autoryzuje #142–#151, po jednym issue/PR.
  Stare „Poza v1” nie blokuje zakresu #147. Pozostaje konkretna zależność od cen;
  #147 i epik #115 pozostają otwarte. #148 nie jest częścią tej pracy.

## Dane potrzebne od OpenBot / właściciela produktu

Prosimy o komentarz człowieka **w #147** zatwierdzający:

| Plan | Pełna cena netto za 12 miesięcy w PLN |
| --- | --- |
| Solo | do podania, maksymalnie dwa miejsca po przecinku |
| Studio | do podania, maksymalnie dwa miejsca po przecinku |
| Pro | do podania, maksymalnie dwa miejsca po przecinku |

Potwierdzenie powinno jasno wskazać, że są to ceny całego rocznego okresu
rozliczeniowego, pobierane z góry i odnawiane co rok. Potrzebna jest również
polityka zmiany miesiąc ↔ rok dla istniejących subskrypcji: termin zmiany
i naliczanie proporcjonalne (proration), ewentualnie jawne pozostawienie zmian
okresu poza portalem. Nie ustalamy jej samodzielnie w Stripe Dashboard.

Na tym etapie nie potrzeba sekretu. Późniejszy test hostowanego Checkout wymaga
klucza **sandbox** i sekretu testowego webhooku dostarczonych bezpiecznym
formularzem, nigdy komentarzem w issue ani logiem. Brak klucza nie blokuje
analizy ani testów z atrapą transportu. Nie wykonano provisioningu ani zakupów.

## Konkretna mapa zmian po decyzji cenowej

1. **Katalog i provisioning:** dodać osobny okres rozliczeń do katalogu,
   zachowując `plan_*_monthly`. Proponowane, jeszcze nieutworzone klucze to
   `plan_solo_yearly`, `plan_studio_yearly`, `plan_pro_yearly`. Zatwierdzone kwoty
   PLN przeliczać przez Decimal do całkowitych groszy; `currency=pln`,
   `tax_behavior=exclusive`, `recurring.interval=year`, `interval_count=1`.
   Skrypt ma walidować istniejącą cenę i być idempotentny; bez cichej podmiany.
2. **Checkout i `/billing`:** jawny wybór okresu, domyślnie miesiąc dla starych
   klientów API. Cena pochodzi wyłącznie z katalogu serwera. Obecny kod ponownie
   używa otwartej sesji po samym `metadata.plan`; trzeba uwzględnić też okres,
   a przy zmianie wygasić poprzednią sesję. Zachować owner-only, membership,
   Origin, lock per studio, trial bez karty i zakaz podwójnego abonamentu.
3. **Webhook:** obecne `pricePlan` odrzuca każdy interwał poza miesiącem.
   Walidować pełny kontrakt obu okresów (klucz, PLN, kwota, podatek, jedna
   pozycja licensed ×1), zapisać okres i cenę potrzebne do projekcji rozliczeń.
   Zachować atomowe `StripeEvent` + stan + audyt, rollback/retry, odczyt bieżącej
   subskrypcji pod lockiem oraz zgodność customer/studio/session/invoice.
   Powrót z Checkout nadal nie nadaje dostępu.
4. **Model i metryki:** Studio przechowuje dziś plan bez okresu; MRR, skład
   planów i zaległości korzystają z miesięcznego katalogu (`billing/mrr.ts`,
   `admin/metrics.ts`, `admin/accounts.ts`, `admin/subscriptions.ts`). Przed
   włączeniem rocznego zastosować addytywną migrację i projekcję faktycznej
   ceny/okresu. MRR roczny normalizować przez 12 jako Decimal, bez zaokrąglania
   pojedynczych kont przed sumowaniem; wpływy pozostają faktycznym netto
   `invoice.paid`. Nie mnożyć liczby rocznych kont przez miesięczną cenę.
   Zaległości prezentować zgodnie z ich rzeczywistym okresem/kwotą.
5. **Landing i portal:** przełącznik oraz pełna cena roczna trafiają razem
   z działającym Checkout; bez fikcyjnej oszczędności. Konfigurację Customer
   Portal rozszerzyć dopiero zgodnie z zatwierdzoną polityką zmian okresu.
   Sama flaga `annual_billing` nie tworzy dziś oferty i nie zastępuje katalogu.
6. **Testy i aktywacja:** regresja wszystkich trzech cen miesięcznych; roczny
   Checkout, ponowne użycie/zmiana sesji, owner/manager/worker i obcy tenant;
   webhook roczny, replay/race, rollback, opóźnione zdarzenia, anulowanie,
   payment_failed/paid, nieprawidłowa kwota/interwał/tenant; MRR Decimal i wpływy;
   landing zgodny z cenami. Zapisy wyłącznie w osobnej bazie testowej po
   migracjach. Potem lint/typecheck/build i hostowany Checkout tylko w sandboxie.
   Bez restartu dev3002/tunelu Redis i bez ingerencji w audyt na 3104.

Stripe Billing rozlicza abonament Detailflow. Nie tworzy `Invoice` klienta
studia ani dokumentu KSeF; nie zmienia reguły faktury po zakończeniu zlecenia.

## Oficjalny kontrakt Stripe sprawdzony 29.10.2026

- [Create Price](https://docs.stripe.com/api/prices/create): osobne ceny,
  `lookup_key`, kwota w najmniejszej jednostce i okres `recurring`.
- [Create Checkout Session](https://docs.stripe.com/api/checkout/sessions/create):
  `mode=subscription`, `line_items.price`, metadata sesji i subskrypcji.
- [Subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks):
  asynchroniczna synchronizacja statusów i płatności, weryfikacja źródła zdarzeń.

## Acceptance #147

- [ ] Zatwierdzone przez człowieka ceny roczne w issue — **brak danych**.
- [ ] Nowe lookup_key, Checkout i webhook — **plan powyżej, niewdrożone**.
- [ ] Landing z przełącznikiem razem z cenami — **niewdrożony**;
  dotychczasowy miesięczny landing pozostaje jedyną ofertą.

PR przygotowawczy używa `Refs #147`, nie `Closes #147`. Pełne acceptance
i niezależna kontrola OpenBot są wymagane przed uznaniem modułu za ukończony;
merge wymaga kolejnego polecenia OpenBot.
