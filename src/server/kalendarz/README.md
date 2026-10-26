# Rezerwacje boksów (#29)

Rezerwacja to `bayId`, `scheduledFrom`, `scheduledTo` istniejącego WorkOrder;
nie powstaje osobna tabela. Wszystkie operacje używają `studioDb(studioId)`.

API wymaga sesji i membershipu studia (owner/manager/worker), a mutacje także
zgodnego Origin. Identyfikator zlecenia to jego `id`, nie numer DF-…:

- `GET /api/studios/:studioId/bookings` — lista przypisanych rezerwacji bez anulowanych zleceń.
- `GET /api/studios/:studioId/bookings/:workOrderId` — jedna rezerwacja.
- `POST /api/studios/:studioId/bookings/:workOrderId` — przypisz boks do zlecenia bez rezerwacji (201).
- `PUT /api/studios/:studioId/bookings/:workOrderId` — zmień istniejącą rezerwację (200).
- `DELETE /api/studios/:studioId/bookings/:workOrderId` — zwolnij boks (204), zachowując zlecenie i planowane daty.

POST/PUT przyjmują `{ bayId, scheduledFrom, scheduledTo }`. Przykład dat:
`2026-10-27T10:00` oznacza 10:00 Europe/Warsaw; ISO z offsetem lub Z określa
konkretną chwilę. Baza przechowuje UTC zgodnie z dotychczasową konwencją.
Nieistniejąca godzina podczas zmiany czasu i niejednoznaczna lokalna godzina
są odrzucane (400); w drugim przypadku API przyjmuje jawny offset.
Koniec musi być późniejszy od początku.

Przedziały są półotwarte `[od, do)`: 10–12 i 12–14 są dozwolone. Kolizja
w tym samym boksie → 409, inny boks → OK. Anulowane zlecenia nie blokują
terminów. Zakończone zachowują historię zajętości; nie można ich rezerwować
ponownie ani przesuwać. Obcy boks/zlecenie i brak rekordu → taki sam 404.

Sprawdzenie kolizji i zapis są jedną transakcją Serializable z ograniczonym
ponowieniem przy konflikcie serializacji (Prisma P2034 / pg adapter
TransactionWriteConflict). Chroni to również równoległe wywołania tego serwisu.
Przyszłe ścieżki zapisu terminów muszą korzystać z `saveBooking`; bezpośredni
zapis Prisma omija walidację. Schemat i seed nie wymagają zmiany.

`/calendar` wyświetla dane wybranego studia i lokalną datę Warszawy.
Przycisk „Nowa rezerwacja” otwiera formularz: wybór istniejącego aktywnego
zlecenia, boksu i terminów; zlecenie z rezerwacją można zmienić lub zwolnić.
Filtr pracownika nie ma danych do przypisania w obecnym modelu.

Testy: `booking.test.ts` — overlap, walidacja i DST, CRUD/HTTP 409,
równoległe kolizje, izolacja dwóch tenantów, autoryzacja i Origin.
Wymagają PostgreSQL z migracjami, jak pozostałe testy repozytorium.
