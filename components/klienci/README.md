# D-05 — lista klientów i karta (#34)

Referencja: [Figma D-05](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-13).

`/customers` (kanoniczny adres; `/klienci` przekierowuje, tak jak `/kalendarz` → `/calendar`)
jest stroną serwerową: `requireStudio()` → `listClients(studioId, …)` z
`src/server/klienci/directory.ts`. Wszystkie zapytania idą przez `studioDb`, więc strona 2,
wyszukiwanie i cudze `?client=` nigdy nie wychodzą poza studio (test w `directory.test.ts`).
Kwoty to `Decimal` → string z dwoma miejscami (`formatPln`), nigdy `float`.

Stan jest w adresie: `?q=`, `?filter=all|regular|coating`, `?page=`, `?client=`.
Filtry, wiersze i paginacja to zwykłe linki, wyszukiwarka to formularz GET — bez JS po stronie klienta
(poza dialogiem „wkrótce”).

- **20 wierszy** na stronę, 7 stron dla 124 klientów. Tabela ma stałą wysokość 549 px i przewija się
  (nagłówek sticky), więc paginacja zostaje pod nią niezależnie od liczby wierszy. Numery stron mają
  okno `1 … 4 5 6 … 12` (`pageItems`), więc kontrolka ma ograniczoną szerokość.
- **Filtry**: Wszyscy / Stali klienci (`isRegular`) / Serwis powłoki (klient z niezamkniętym
  `CoatingReminder`). Liczniki chipów dotyczą całego studia, nagłówek „N klientów · M aut” — bieżącego widoku.
- **Szukaj**: nazwisko, telefon (`600123`, `+48600123456` i `600 123` trafiają w „+48 600 123 456”),
  rejestracja (`wa911pc` trafia w „WA 911PC”). `%` i `_` są escapowane.
- **Kolejność**: od najdłużej współpracujących (`createdAt`, `id`). Seed nadaje kolejne sekundy,
  więc strona 1 odtwarza makietę (Adam Nowak pierwszy i zaznaczony).
- **Ostatnia wizyta** = najpóźniejsze rozpoczęte zlecenie bez anulowanych (przyszła rezerwacja nie liczy się).
  **Łączna wartość** = suma brutto zleceń bez anulowanych, także trwających — jak w makiecie.
- **Karta**: bez `?client=` pokazuje pierwszy wiersz. Auto z trwającym zleceniem ma kafel i plakietkę
  prowadzącą do `/orders/<numer>`; pozostałe są w wersji zwartej. „Ostatnie wizyty” to 3 najnowsze zlecenia.

## Odstępstwa od Figmy

- **Zaznaczony wiersz**: w Figmie to `--df-raised` z lime lewą krawędzią 2 px (tak jak aktywna pozycja
  sidebara); kryterium issue mówi o „limeDark”. Wdrożone jest wg Figmy — zmiana to jedna klasa w `ClientsScreen.tsx`.
- **Zdjęcie auta**: model `Vehicle` nie ma zdjęcia, więc kafel z Porsche to slot `▱` (jak auto bez zdjęcia),
  nie cudza fotografia.
- **Wizyty Nowaka**: karta pokazuje trzy najnowsze prawdziwe zlecenia, więc obok 24.10 i 14.08 jest
  DF-0243 (23.10, źródło FV/41), którego w makiecie brakuje.
- „＋ Dodaj klienta” prowadzi do `/customers/new` (CRUD + import CSV z #35). „＋ Dodaj” na karcie
  otwiera edycję klienta (`/customers/:id`). „Cała historia ↗” zostaje dialogiem „wkrótce”.
  Plakietka „Zlecenie w trakcie” prowadzi do D-04.
