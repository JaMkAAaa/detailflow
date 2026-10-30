# D-01 Pulpit — #26 / #27

Referencja: [D-01 / Przegląd dnia](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=1-3).

Strona wymaga `requireStudio()`. `src/server/pulpit/metrics.ts` pobiera dane przez
`studioDb(studioId)`; identyfikator studia pochodzi z autoryzowanej sesji.
Do komponentu klienta trafiają kwoty PLN jako stringi z dwoma miejscami po
przecinku, bez konwersji do float. Nie ma fallbacku na dane demonstracyjne.

Definicje KPI v1:

- Przychód miesiąca: suma `WorkOrder.totalGross` dla `completed`, według
  `completedAt` w miesiącu kalendarzowym Europe/Warsaw. To wartość wykonanych
  usług brutto, nie wpływy na konto, Stripe ani suma faktur TEST/PROD.
  Ekran `/statistics` (#144) używa tej samej definicji przychodu dla dowolnego zakresu dat
  (`src/server/statystyki/statistics.ts`, docs §6.5).
- Aktywne: `accepted`, `in_progress`, `ready_for_pickup`, niezależnie od terminu.
  `completed` i `canceled` są wykluczone.
- Obłożenie: suma unii przedziałów aktywnych zleceń w każdym boksie na dziś,
  przyciętych do 08:00–16:00 / (liczba boksów × 8 h). Nakładające się rezerwacje
  nie liczą czasu podwójnie. Brak boksów daje 0%. Stałe godziny to założenie v1,
  dopóki nie powstanie konfiguracja godzin pracy studia.
- Powracający: liczba klientów z `isRegular` / wszyscy klienci studia. To udział
  stałych klientów w bazie, bez fikcyjnego porównania z poprzednim miesiącem.

„Na warsztacie” wybiera pierwsze (termin, numer) `in_progress` w boksie, którego
przedział przecina dzisiejszy dzień. Nie wymaga, żeby aktualna godzina mieściła
się w rezerwacji. Karta ma pusty stan; nie pokazuje fotografii innego auta.
Plan i tabela dnia również korzystają z danych studia. Plan pokazuje dziś
08:00–16:00; pełna nawigacja kalendarza pozostaje pod `/calendar`.

Alerty:

- Magazyn (#143): rzeczywisty alert chemii przy ilości ≤ progu, także zero; link `/inventory`, odczyt przez `studioDb`, bez fikcyjnego alertu CarPro.
- Ceramika: jawne `CoatingReminder` dla pojazdu, z `dueAt` i opcjonalnym
  `completedAt`. Niezrealizowane zaległe terminy oraz terminy do końca dnia za
  7 dni. Licznik to unikalni klienci, nie liczba aut ani przypomnień. Nie
  zgadujemy terminów z tekstu nazwy usługi. Seed dodaje 3 klientów.
- KSeF: wystawione faktury ze statusem `rejected`, wyłącznie w środowisku
  wybranym przez studio. TEST i PROD mają osobne oznaczenia i wyniki. Do
  podłączenia integracji E9 wyniki pochodzą z istniejących rekordów/seeda.

Pulpit (desktop) otwiera `/orders?new=1`: ten sam `OrderCreateDialog` co tablica.
Mobilny „+” prowadzi do pełnego ekranu `/orders/new`. Karty i wiersze prowadzą do zlecenia, mobilne zakończenie etapu
wywołuje API advance i odświeża dane. Link klienta powstaje przez `portal-links`;
URL jest widoczny tylko do zamknięcia dialogu, bez zapisu w przeglądarce i logach.
Faktury otwierają istniejący kreator z wyborem wyłącznie zakończonych zleceń;
worker otrzymuje komunikat o uprawnieniach. Mobilny dzwonek pokazuje alerty
ceramiki i KSeF z tych samych danych co pulpit. Zdjęcie prowadzi do karty
zlecenia; interfejs zarządzania zdjęciami pozostaje osobnym issue #136.
`demo.ts` i stary `schedule.tsx` są scenariuszami testowymi #26, nie źródłem
produkcyjnych danych pulpitu.

Weryfikacja: testy Postgres `src/server/pulpit/metrics.test.ts` sprawdzają dwa
studia, wykluczenie zakończonych, grosze Decimal, granice miesiąca i DST,
obłożenie, wybór auta i środowiska KSeF. Testy UI sprawdzają dane i puste stany.
`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`.
