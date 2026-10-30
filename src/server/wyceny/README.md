# Zapis i wysyłka wycen — #38

`PUT /api/studios/:studioId/quotes/:quoteId` zapisuje szkic i zastępuje pozycje
w jednej transakcji Serializable. ID nowej wyceny to UUID tworzony przez kreator
przed pierwszym zapisem. Ponowienie żądania zachowuje ID. Konflikt równoległego
zapisu zwraca 409. Wysłane i rozstrzygnięte wyceny są nieedytowalne.
`GET` pozwala odczytać zapisany dokument, również po przeładowaniu kreatora.
Kwoty liczy serwer silnikiem domenowym, Decimal/PLN, niezależnie od podglądu UI.

`POST .../:quoteId/send` atomowo ustawia `sent` i zapisuje trwały job
`QuoteSendMail`. Sprawdza e-mail klienta i pozycje. Ponowienie oczekującego joba
scala wysyłkę; po dostarczeniu można zlecić kolejną. Wysyłka nigdy nie zapisuje
ani nie dopisuje pozycji. API wymaga sesji, członkostwa owner/manager i zgodnego
Origin dla zapisu. Wszystkie operacje tenantowe używają `studioDb`.

Worker co 15 s odbiera joby z istniejącego outboxa PostgreSQL, tak jak maile
decyzji portalu. Zapis jest trwały również przy wyłączonym workerze lub braku
SMTP. Nie dokładamy drugiej kolejki Redis do istniejącego mechanizmu maili.
Blokady w transakcji zapobiegają jednoczesnej wysyłce joba przez dwa workery.
Błąd SMTP wycofuje zapis i zostawia job do ponowienia. `Quote.sentAt` oznacza
ostatnie skuteczne przekazanie do SMTP. SMTP daje dostawę co najmniej raz:
awaria między przyjęciem wiadomości a commitem może spowodować powtórkę.

Token 256-bit powstaje w workerze. W bazie tylko SHA-256 i TTL 14 dni;
surowy token wyłącznie w URL wiadomości, nigdy w jobie ani logach. Korzystamy
z istniejącego E8 `/p/:token`, bez stubu. Link z ponownej wysyłki nie unieważnia
poprzednich linków (ich cofanie zapewnia API E8).

Ten sam worker co 15 s ustawia `expired` dla `sent` bez `decidedAt`, gdy
minie 14 dni od ostatniego `sentAt` lub nie ma już ważnego linku wyceny ani
powiązanego zlecenia — wcześniejszy warunek wygrywa. Oczekująca pierwsza
wysyłka (`sentAt: null`) nie wygasa przed przekazaniem do SMTP. Sweep nie
zmienia decyzji ani nie wysyła maila; warunek aktualizacji chroni także przed
równoczesną decyzją. Endpoint decyzji odrzuca `expired` i przekroczenie 14 dni
również przed następnym przebiegiem workera. Discovery studiów jest platformowe,
a każda aktualizacja wycen przechodzi przez `studioDb`.

## Katalog usług

Źródłem katalogu jest tabela `Service`. Ekran `/services` (owner/manager,
`services:manage`) dodaje, edytuje, ukrywa i usuwa usługi: nazwa, cena bazowa
brutto jako Decimal PLN, czas i widoczność. Worker nie ma tego uprawnienia.
Ukryta usługa nie wchodzi do nowych wyborów w kreatorze ani w formularzu
zlecenia. Pozycja już zapisanej wyceny zostaje w szkicu jako snapshot, ale nie
wraca do listy „dodaj z katalogu”.

`QuoteItem` nie ma klucza obcego do `Service`. Zmiana ceny i usunięcie usługi
nie przepisują historycznych pozycji. `seedServices` jest tylko dla seeda demo
i testów (4 usługi D-06 w `DEFAULT_SERVICES`). Wejście w wyceny albo zlecenia
nie odtwarza usuniętego katalogu, więc pusta lista zostaje pusta po odświeżeniu.
Plik `src/domain/service-catalog.ts` zasila wyłącznie wariant demonstracyjny
kreatora i testy UI.

Prosta edycja nazwy, ceny i czasu w katalogu wizarda nadal zapisuje aktywną
`Service` studia. Dotyczy to przyszłych wyborów, nie wysłanych wycen.

Strona `/quotes/new` ładuje klientów z pojazdami, katalog usług i najnowszy
szkic autora przez `studioDb`. Kreator zapisuje ten sam szkic ponownie po tym
samym ID i pokazuje wysłaną wycenę po powrocie na stronę.

Uruchomienie lokalne: `pnpm db:deploy`, `pnpm dev`, `pnpm worker` z
`SMTP_URL=smtp://localhost:1025` i `APP_URL=http://localhost:3000`
(wewnątrz Compose: `smtp://mailpit:1025`). Wiadomości: http://localhost:8025.
Kreator używa klientów/pojazdów aktywnego studia; pusta baza wymaga dodania
klienta z autem. Szkic lokalny jest przypisany do studioId/userId. Terminy
pozostają demonstracyjne, nie są rezerwacją ani częścią wysyłanego maila.

## SMS klienta (#149)

Opcjonalne `sms: { phone, consent: true }` w żądaniu wysyłki tworzy osobny
outbox `QuoteSendSms`. E-mail jest nadal wymagany. Konfiguracja, zgoda,
statusy i ograniczenia: [SMS klienta](../../../docs/sms-klienta.md).
