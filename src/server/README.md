# Panel platformy (#52)

A-01 i shell `/admin`: `admin/README.md`. Osobna sesja operatora, nie membership.

# Klienci i auta (#35)

`src/server/klienci`. Lista D-05 (`directory.ts`, 20/stronę w SQL) i CRUD + import CSV (`clients.ts`).
Tablica w studiu jest ostrzeżeniem (`duplicate_plate`), nie `@@unique` — duplikaty
historyczne z Excela i zmiana właściciela auta mają przejść. Import i odczyty
używają `studioDb(studioId)` i nie mieszają tenantów. Szczegóły w `klienci/README.md`.

# Dostęp do studia (#25)

- `authorizeStudio(userId, studioId, permission)` sprawdza membership przy każdym wywołaniu i zwraca `studioDb(studioId)`.
- `studio:read`: owner, manager, worker. `studio:settings`: owner. `invoices:manage` i `members:invite`: owner, manager. Każda przyszła mutacja faktury musi wymagać `invoices:manage` po stronie serwera.
- API: brak sesji → 401, cudze studio lub brak uprawnienia → 403. Obcy/nieistniejący rekord w dostępnym studiu → ten sam 404.
- `POST /api/studios/active` (`{ studioId }`) zapisuje wybór w cookie httpOnly dopiero po autoryzacji; cookie nie jest źródłem uprawnień.
- `POST /api/studios/:studioId/invitations` (`{ email, role: "manager" | "worker" }`) oraz formularz `/team` wysyłają e-mail przez istniejące SMTP. Zaproszenia nie nadają roli owner.
- `/invite/:token`: logowanie (dla nowych kont linkiem e-mail), jawne przyjęcie zaproszenia. Token 256 bitów, SHA-256 w bazie, ważność 7 dni, atomowe jednorazowe wykorzystanie i membership. Istniejąca rola pozostaje bez zmian.
- Provisioning zaproszonego konta i odkrywanie membershipów/tokenu to granice auth korzystające z `platformDb`; operacje znanego studia używają `studioDb`.

Testy `acl.test.ts` wymagają PostgreSQL z migracjami. Tworzą dwa niezależne studia i sprawdzają ten sam endpoint, role, picker, wygasanie i równoległe wykorzystanie zaproszenia. Nie używać produkcyjnej bazy do testów.

# Maszyna stanów zlecenia (#31)

`src/server/zlecenia/state.ts`. Mutacje wymagają `orders:update` (owner, manager, worker) i `studioDb(studioId)`.

- Mapa przejść jest tabelą `ORDER_TRANSITIONS`: `accepted → in_progress | canceled`, `in_progress → ready_for_pickup | canceled`, `ready_for_pickup → completed | in_progress` (poprawka). `completed` i `canceled` są końcowe. Skok `accepted → completed/ready_for_pickup` jest odrzucany (`invalid_transition`).
- Etap pasuje do statusu: przyjęte 1, w trakcie 1–3, do odbioru i zakończone 4. `advanceStage` ("Zakończ: etap") przesuwa o jeden; koniec etapu 3 daje „Do odbioru” i etap 4.
- `transitionOrder` jest punktem wejścia dla DnD (5.1). Upuszczenie w tej samej kolumnie nic nie zapisuje; równoległe zmiany kończą się `conflict` dla przegranej.
- Każda zmiana zapisuje wpis `WorkOrderEvent` w tej samej transakcji (`listOrderHistory` → zakładka Historia).
- Fakturować można tylko `completed` z `completedAt` (`canInvoice`, `assertInvoiceable`). Każda przyszła mutacja faktury z zlecenia wywołuje `assertInvoiceable`.
- Numer `DF-####`: `allocateOrderNumber` w transakcji tworzenia zlecenia (atomowy licznik `OrderCounter` na studio, unikalność dodatkowo wymusza `@@unique([studioId, number])`).

# Wyceny (#38)

Zapis szkicu i pozycji, katalog oraz trwały outbox e-mail: `wyceny/README.md`.
Server actions wymagają `quotes:manage` (owner/manager); worker korzysta z `studioDb`.
