# Konto użytkownika — #151

`/account` jest dostępne z menu desktopowego „Konto” i karty użytkownika w mobilnym „Więcej”, dla ownera, managera i pracownika. Korzysta z istniejących tokenów i formularzy aplikacji; prototyp nie zawiera osobnej gotowej ramki konta. To konto osoby, wspólne dla jej studiów, oddzielne od operatora `/admin`.

## Hasło i sesje

Zmiana wymaga obecnego hasła i nowego hasła o długości co najmniej 10 znaków. Better Auth weryfikuje Argon2id. Hook serwera wymusza `revokeOtherSessions: true`, również gdy klient przesyła `false` lub pomija parametr. Po udanej zmianie stare sesje zostają usunięte, a przeglądarka otrzymuje nowe cookie sesji. Błędne lub za krótkie hasło nie unieważnia sesji. Reset hasła nadal unieważnia wszystkie sesje.

Lista pokazuje aktywne sesje wyłącznie zalogowanej osoby: bieżącą sesję, user-agent (deklaracja przeglądarki, bez identyfikacji urządzenia), IP, datę utworzenia i wygaśnięcia (Europe/Warsaw). DTO nie zawiera tokenów sesji ani haseł. „Wyloguj pozostałe sesje” zachowuje bieżącą sesję; działa na całym koncie, także przy członkostwie w kilku studiach. Wrażliwe operacje zachowują wymóg świeżości sesji Better Auth; po błędzie użytkownik dostaje prośbę o ponowne logowanie.

Konto korzystające dotąd tylko z magicznego linku ustawia hasło przez istniejący reset e-mail; nie omijamy weryfikacji obecnego hasła. Endpoint zmiany hasła ma limit 5 prób/min. Endpointy Better Auth sprawdzają Origin.

## Powiadomienia

Migracja `20261030100000_account_preferences` dodaje `User.trialReminderEnabled`, domyślnie `true`, także dla istniejących kont. `PATCH /api/account/preferences` przyjmuje wyłącznie `{ trialReminderEnabled: boolean }`; tożsamość bierze z sesji, wymaga Origin i ma limit zapisów. Preferencję może zmienić każda rola, również po ograniczeniu abonamentu.

Worker przypomnienia trialowego odczytuje właścicieli przez `studioDb(studioId)` i filtruje ich indywidualne preferencje tuż przed wysyłką. Jeśli wszyscy odmówili, nie wywołuje SMTP, a przebieg oznacza jako obsłużony; ponowne włączenie nie odtwarza pominiętego przypomnienia tego trialu. Pozostaje lock per studio i retry po błędzie SMTP. Brak właściciela nadal jest błędem.

Preferencja nie jest ogólnym wyłączeniem maili. Reset hasła, magic link, faktury i inne wiadomości transakcyjne nie odczytują tej flagi. Faktury klienta studia nadal mają osobną kolejkę i odbiorcę z danych klienta.

Dane konta są danymi auth/platformy i używają `platformDb` z ID zalogowanej osoby, tak jak Better Auth. Nie przyjmujemy `userId` ani `studioId` od przeglądarki. Testy obejmują dwie osoby w różnych studiach, brak tokenów w DTO, sesje wygasłe, wymuszoną rotację hasła, odwołanie cudzych sesji, Origin, preferencję i odbiorców trialu. Brak zmian w panelu operatora i brak deklaracji rzeczywistej dostawy SMTP.
