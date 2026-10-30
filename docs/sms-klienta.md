# SMS klienta — #149

Jedna opcjonalna wiadomość z nazwą studia i linkiem `/p/:token` przy wysyłce
wyceny. E-mail jest wymagany i wysyłany niezależnie. SMS czeka na skuteczne
przekazanie maila do SMTP. Nie ma powiadomień o etapach, trialu ani marketingu.

## Konfiguracja i użycie

Ustaw `SMSAPI_TOKEN` (OAuth Bearer) i zatwierdzoną nazwę nadawcy `SMSAPI_SENDER`
w środowisku weba i workera, a także `APP_URL` (publiczny HTTPS w produkcji)
i `SMTP_URL`. Uruchom `pnpm db:deploy` i worker. Konto oraz saldo SMSAPI
zapewnia operator wdrożenia; koszt według taryfy dostawcy, poza Stripe Billing.
Brak któregokolwiek ustawienia SMSAPI ukrywa opcję w kreatorze i blokuje
ręczne żądanie API z SMS. Nie powoduje błędów przy zwykłej wysyłce maila.

W kroku 3 kreatora (desktop i telefon) owner/manager zaznacza opcję SMS
z potwierdzeniem zgody klienta na tę wiadomość i widocznym numerem odbiorcy.
Opcja domyślnie niezaznaczona; bez poprawnego polskiego numeru jest nieaktywna.
Numer pochodzi z klienta studia. Zmiana klienta usuwa zaznaczenie, a serwer
porównuje numer z bazą — nie przyjmuje dowolnego odbiorcy z żądania.
Obsługujemy polskie numery: 9 cyfr, 48, +48 lub 0048; spacje, nawiasy i myślniki
są normalizowane. Nie obsługujemy list odbiorców ani numerów zagranicznych.

API `POST /api/studios/:studioId/quotes/:quoteId/send` przyjmuje opcjonalne
`{"sms":{"phone":"+48 500 600 700","consent":true}}`. Puste body i `{}`
zachowują dotychczasową wysyłkę tylko mailem. W outboxie zapisujemy numer,
czas potwierdzenia i ID użytkownika potwierdzającego zgodę. Jest to oświadczenie
pracownika o zgodzie klienta na jednorazowy kontakt, bez zgody marketingowej.
Wysyłka po zmianie numeru, decyzji klienta lub wygaśnięciu wyceny jest anulowana.

## Dostawa, prywatność i ponowienia

`QuoteSendSms` ma status `pending`, `sent`, `failed` lub `cancelled`, widoczny
po odświeżeniu strony wyceny. `sent` oznacza przyjęcie przez SMSAPI, bez dowodu
doręczenia na telefon. Nie wdrażamy callbacków DLR. Błąd SMS nie cofa maila.
Jedna wycena ma najwyżej jeden job SMS: ponowne kliknięcie nie dokłada wiadomości,
a „Wyślij ponownie” ponawia mail. Nie ma osobnego ręcznego ponowienia SMS.

Worker co 15 s sprawdza outbox przez `studioDb`. Atomowa rezerwacja i licznik
prób chronią przed równoległymi workerami. Maksymalnie 5 prób; odstępy 1/2/4/8/16
minut, timeout HTTP 10 sekund. Po wyczerpaniu prób status `failed` wymaga kontaktu
z klientem innym kanałem. Brak konfiguracji zatrzymuje outbox bez zużywania prób.

SMSAPI otrzymuje POST HTTPS z Bearer oraz `idx=job.id`, `check_idx=1`. Kod 53
uznajemy za wcześniejsze przyjęcie tego samego joba. Dostawca deduplikuje przez
24 h; ponowienia rozpoczętych prób po 23 h od utworzenia joba są wyłączone,
żeby awaria i długi przestój nie wysłały duplikatu poza tym oknem.
[Dokumentacja SMSAPI](https://www.smsapi.pl/docs/).

Token 256-bit powstaje w workerze, wyłącznie w ścieżce URL; baza przechowuje
SHA-256 i TTL 14 dni. Nie przechowujemy treści SMS ani URL w outboxie lub logach.
Link zapisuje się przed wywołaniem HTTP, więc pozostaje ważny również po
niejednoznacznym timeoutcie. Każda próba tworzy nowy hashowany link; poprzednie
pozostają ważne, aby deduplikacja dostawcy nie unieważniła już wysłanego SMS.
SMS i mail używają tego samego krótkiego routingu portalu, z osobnymi tokenami.
Nie ma zewnętrznego skracacza, danych auta, kwoty ani imienia klienta w SMS.

## Walidacja i granice

Migracja i testy Postgres obejmują dwa studia, zgodę i numer, brak dostawcy,
mail przed SMS, równoległe workery, timeout, kod 53, wyczerpanie prób,
anulowanie po zmianie numeru/decyzji oraz przechowywanie wyłącznie hashy.
UI sprawdza ukrytą opcję, brak domyślnej zgody i wysyłany kontrakt API.
Testy używają atrapy SMSAPI. Nie wykonano płatnej wysyłki ani hosted smoke
z rzeczywistym kontem; kod nie stanowi dowodu doręczenia SMS.
