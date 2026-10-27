# Zapis i wysyłka wyceny (#38)

`/quotes/new` (alias `/wyceny/nowa`) ładuje klientów, auta i katalog aktywnego
studia. Owner/manager mają `quotes:manage`; server actions ponownie sprawdzają
sesję, membership i zgodność aktywnego studia z formularzem.

- Szkic zapisuje się po 500 ms bezczynności. Źródłem prawdy jest PostgreSQL;
  localStorage to pomocnicza kopia niezapisanego formularza. Przy ponownym wejściu
  formularz odtwarza najnowszą wycenę autora, jej rewizję i snapshot pozycji.
- `saveQuote` przelicza brutto/VAT silnikiem #36 (Decimal, PLN), sprawdza
  klienta/auto i usługi przez `studioDb`, zastępuje pozycje w transakcji.
  Rewizja chroni przed nadpisaniem równoległych zmian. Nie można edytować
  wysłanej wyceny ani szkicu oczekującego na wysyłkę.
- `sendQuote` zapisuje snapshot wiadomości w `QuoteEmail` (outbox). Nie tworzy
  nowych pozycji. Dopóki istnieje oczekujące zadanie, następne kliknięcie używa
  go ponownie. Po wysyłce można utworzyć kolejną wiadomość dla tej samej wyceny.
- Worker co 5 s przekazuje oczekujące wpisy do BullMQ. Job ID = ID outboxa,
  payload = tylko `studioId` i `emailId`. Awaria Redis nie usuwa outboxa.
  SMTP jest ponawiane co 30 s; błąd nie ustawia statusu `sent`.
- Po akceptacji przez SMTP worker atomowo ustawia `QuoteEmail.sentAt` oraz
  `Quote.status = sent`, `Quote.sentAt`. Ponowienie zakończonego joba to no-op.
  SMTP nie gwarantuje exactly-once: awaria między przyjęciem wiadomości a commitem
  może spowodować ponowne dostarczenie. Message-ID pozostaje stałe dla joba.
- `seedServices` inicjalizuje cztery usługi D-06 w seedzie demo i przy pierwszym
  wejściu do wycen danego studia. Ponowne seedowanie nie nadpisuje edycji.
  Prosta edycja nazwy, ceny i czasu jest dostępna w katalogu w wizardzie.
  Istniejące wyceny zachowują snapshot cen. Menu „Usługi i cennik” pozostaje
  poza zakresem tej implementacji.

## Lokalnie

Zastosuj migracje: `pnpm db:deploy`. Uruchom web i `pnpm worker` z tym samym
`DATABASE_URL`, `REDIS_URL`. `SMTP_URL=smtp://mailpit:1025` w Compose,
`smtp://localhost:1025` na hoście. Mailpit: `http://localhost:8025`.
Produkcja: `pnpm build` oraz `pnpm worker:start` (osobny proces/kontener).

Link w e-mailu prowadzi do jawnego stubu `/p/quote-preview`, bez dostępu do
wyceny i bez tokena. Integracja z tokenem i decyzją klienta należy do E8.2.
Terminy w wizardzie pozostają propozycjami z UI #37; wysyłka nie rezerwuje boksu.

## Testy

`send.test.ts` wymaga pustej lokalnej bazy PostgreSQL z migracjami. Obejmuje
izolację tenantów (również worker i katalog), ACL, powtórne/współbieżne zapisy,
ponowną wysyłkę, snapshot cen, brak e-maila oraz awarie Redis/SMTP.
Dodatkowo `MAILPIT_TEST=1 SMTP_URL=smtp://localhost:1025` włącza rzeczywistą
wysyłkę SMTP i kontrolę wiadomości przez API lokalnego Mailpit.
