# Klienci i auta (#35)

CRUD i import CSV. Każde zapytanie idzie przez `studioDb(studioId)`.
Mutacje API wymagają sesji, membershipu (owner/manager/worker) i zgodnego Origin.

## Tablica — ostrzeżenie, nie twardy fail

Nie ma `@@unique([studioId, plate])`. Ten sam numer w studiu **zapisuje się**;
odpowiedź dostaje `warnings: [{ code: "duplicate_plate", ... }]`.

Powody:

1. Landing obiecuje import z Excela. Rzeczywiste arkusze mają historyczne duplikaty.
2. Tablica wraca do studia przy nowym właścicielu (sprzedaż auta).
3. Ten sam numer w **innym** studiu jest zawsze dozwolony — izolacja tenantów.

Porównanie normalizuje wielkość liter, spacje i myślniki (`WA 911PC` = `wa911pc`).
UI D-05 może pokazać banner; API nie blokuje zapisu.

## Paginacja

`listClients` robi `take: 20` / `skip` w SQL. Nie wolno pobierać 124 wierszy i
kroić ich w przeglądarce. `GET /api/studios/:studioId/clients?page=&q=` zwraca
`{ items, total, page, pageSize, vehicleTotal }`.

## API

- `GET /api/studios/:studioId/clients?page=1&q=` — strona 20 wierszy, szukanie po nazwie / e-mailu / telefonie / tablicy / marce / modelu.
- `POST /api/studios/:studioId/clients` — `{ name, email?, phone?, street?, postal?, city?, nip?, isRegular?, vehicle? }` → 201.
- `GET|PATCH|DELETE /api/studios/:studioId/clients/:clientId` — karta, edycja, usunięcie (409 przy zleceniach/wycenach).
- `POST /api/studios/:studioId/clients/:clientId/vehicles` — dodaj auto.
- `PATCH|DELETE /api/studios/:studioId/vehicles/:vehicleId` — edycja (w tym `clientId` w tym samym studiu) / usunięcie.
- `POST /api/studios/:studioId/clients/import` — JSON `{ csv }`, `text/csv` albo `multipart` pole `file`.

CSV: kolumny `imię, telefon, e-mail, marka, model, tablica` (aliasy PL/EN; Excel `;` albo `,`; BOM).
Wiersz bez imienia/marki/modelu/tablicy jest pomijany z błędem, reszta wchodzi.
Dopasowanie istniejącego klienta: e-mail, potem telefon — **tylko w tym studiu**.
Ten sam klient + ta sama tablica przy ponownym imporcie = `unchanged`.

Obcy identyfikator i brak rekordu → ten sam 404.

Testy: `clients.test.ts` — parser CSV, 20/stronę, ostrzeżenie tablicy, izolacja dwóch tenantów, HTTP 401/403/Origin.
Wymagają PostgreSQL z migracjami.
