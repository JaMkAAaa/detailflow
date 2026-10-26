# Dostęp do studia (#25)

- `authorizeStudio(userId, studioId, permission)` sprawdza membership przy każdym wywołaniu i zwraca `studioDb(studioId)`.
- `studio:read`: owner, manager, worker. `invoices:manage` i `members:invite`: owner, manager. Każda przyszła mutacja faktury musi wymagać `invoices:manage` po stronie serwera.
- API: brak sesji → 401, cudze studio lub brak uprawnienia → 403. Obcy/nieistniejący rekord w dostępnym studiu → ten sam 404.
- `POST /api/studios/active` (`{ studioId }`) zapisuje wybór w cookie httpOnly dopiero po autoryzacji; cookie nie jest źródłem uprawnień.
- `POST /api/studios/:studioId/invitations` (`{ email, role: "manager" | "worker" }`) oraz formularz `/team` wysyłają e-mail przez istniejące SMTP. Zaproszenia nie nadają roli owner.
- `/invite/:token`: logowanie (dla nowych kont linkiem e-mail), jawne przyjęcie zaproszenia. Token 256 bitów, SHA-256 w bazie, ważność 7 dni, atomowe jednorazowe wykorzystanie i membership. Istniejąca rola pozostaje bez zmian.
- Provisioning zaproszonego konta i odkrywanie membershipów/tokenu to granice auth korzystające z `platformDb`; operacje znanego studia używają `studioDb`.

Testy `acl.test.ts` wymagają PostgreSQL z migracjami. Tworzą dwa niezależne studia i sprawdzają ten sam endpoint, role, picker, wygasanie i równoległe wykorzystanie zaproszenia. Nie używać produkcyjnej bazy do testów.
