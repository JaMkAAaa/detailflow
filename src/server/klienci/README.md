# Klienci i auta (#35)

CRUD i import CSV/XLSX. Lista D-05 (`directory.ts`) i mutacje (`clients.ts`) idą przez `studioDb(studioId)`.
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
- `POST /api/studios/:studioId/clients/import` — JSON `{ csv }`, `text/csv` albo multipart `file`; XLSX przyjmuje multipart `file`.

CSV/XLSX: kolumny `imię, telefon, e-mail, marka, model, tablica` (aliasy PL/EN; CSV obsługuje `;`, `,`, tab i BOM; XLSX czyta pierwszy arkusz). Limit obu formatów: 1 MB i 5000 wierszy.
Wiersz bez imienia/marki/modelu/tablicy jest pomijany z błędem, reszta wchodzi.
Dopasowanie istniejącego klienta: e-mail, potem telefon — **tylko w tym studiu**.
Ten sam klient + ta sama tablica przy ponownym imporcie = `unchanged`.

Obcy identyfikator i brak rekordu → ten sam 404.

Testy: `clients.test.ts` — parser CSV/XLSX, pierwszy arkusz, limity i błędne pliki, 20/stronę, ostrzeżenie tablicy, izolacja dwóch tenantów, HTTP 401/403/Origin.
Wymagają PostgreSQL z migracjami.

## Dane osobowe (#127)

Owner/manager: `POST /api/studios/:studioId/clients/:clientId/privacy` z `{ action: "export" | "erase" }`, sesja i Origin. UI na karcie klienta; worker nie widzi akcji i dostaje 403 z API. Eksport JSON bez cache zawiera klienta, auta, statusy/daty/kwoty zleceń, wyceny i metadane portalu bez tokenu/hashu.

Usunięcie klienta bez zleceń usuwa także wyceny i auta. Historia zleceń wymaga anonimizacji: nazwa, kontakt, adres, NIP klienta, tablice i notatki wycen. Dokumenty księgowe (snapshot nabywcy, numery FV, zapisany XML KSeF) zostają niezmienione. PDF faktury nie ma pól telefonu/e-maila klienta. Akceptacja i treść protokołu pozostają; model nie zapisuje podpisu ani kontaktu klienta osobno. Usuwamy tylko odnośnik do usuwanego zdjęcia.

Jeśli link PUT zdjęcia może być jeszcze ważny (5 minut + minuta marginesu), API zwraca 409 i prosi o ponowienie za 6 minut, aby upload nie odtworzył obiektu po usunięciu wiersza. Obiekty S3 usuwane przed wierszami, także niepotwierdzone uploady. Błąd S3 wycofuje zmiany DB i pozwala ponowić idempotentne DELETE obiektu. S3 nie jest transakcyjne: wcześniejsze usunięte obiekty mogą już być niedostępne po błędzie kolejnego. Linki portalu są odwoływane, oczekujące maile wycen i przypomnienia powłoki usuwane. Transakcja Serializable zwraca 409 przy konflikcie. AuditLog zawiera tylko identyfikator klienta i wynik operacji; nie zawiera kontaktu, notatek ani tokenów.
