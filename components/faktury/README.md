# Faktury — #41 i #42

## Lista i wymagające uwagi — #41

[D-07](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=22-258)
i [D-10](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=22-831):
`/invoices` oraz `/invoices/attention`, z aliasami `/faktury` i `/faktury/uwaga`.
Oba widoki wymagają `invoices:manage`. Czytnik listy i licznik nawigacji używają
`studioDb(studioId)` oraz środowiska skonfigurowanego w aktywnym studiu.
Licznik uwagi obejmuje wystawione dokumenty `rejected` i `retrying` (2 w seedzie).
Pracownik nie odczytuje licznika i nie widzi linku do faktur.

Lista ma wyszukiwanie po numerze, nabywcy, NIP (także bez separatorów) i zleceniu,
filtry statusów oraz nieopłaconych i zaległych, paginację po 7 dokumentów,
pełny numer KSeF w tooltipie i kopiowanie ze zgłoszeniem błędu schowka.
Przyjęte, nieopłacone dokumenty są bursztynowe; odrzucenie KSeF jest czerwone.
Zaległość liczymy od dnia po terminie w strefie Europe/Warsaw.

Karty podsumowań pokazują rzeczywiste dane dostępne w danym środowisku,
bez fikcyjnych 41 dokumentów / 52 380 zł z Figmy. Kwoty sumujemy przez Decimal.
Karta brutto/VAT obejmuje przyjęte faktury, bez szkiców i odrzuceń.
Daty i próby na D-10 pochodzą z historii; komunikaty archiwalne są datowane.
Panel połączenia nie udaje pomiarów MF ani ważności tokenu. Ponowienie i poprawa
NIP są jawną demonstracją bez zapisu, wysyłki do MF i usuwania błędów z kolejki.
Eksport JPK_FA(4) pobiera walidowany XML dla wybranego okresu i środowiska; pusty okres pokazuje komunikat. [Kontrakt](../../docs/jpk-fa.md). Offline pozostaje wyłączony.
Zaległe płatności mają osobną sekcję. Używamy istniejących lokalnych assetów
badge 6 × 6 oraz wspólnego sidebara, fontów i tokenów.

## Kreator i szczegóły — #42

[D-08](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=22-449)
i [D-09](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=22-640).

Trasy zgodne z istniejącą nawigacją: `/invoices/new` oraz
`/invoices/FV%2F41%2F10%2F2026?env=test`. Polskie aliasy
`/faktury/nowa` i `/faktury/[number]` przekierowują na te ekrany.
Wszystkie ekrany wymagają `invoices:manage` (owner/manager).

Odczyty korzystają z `studioDb(studioId)`. Wspólny czytnik zasila też istniejące
GET `/api/studios/[studioId]/invoices/[invoiceId]`. Numer faktury jest rozwiązywany
w obrębie studia i środowiska; brak parametru `env` wybiera konfigurację studia,
a nie pierwszy dokument o tym numerze. Każdy panel KSeF oznacza TEST albo PROD.

Wizard wybiera wyłącznie zakończone zlecenia z datą zakończenia. Pozycje scenariusza
pochodzą z pierwszej istniejącej faktury zlecenia, a przy jej braku z opisu i kwoty
zlecenia. Nie odczytuje niezwiązanej wyceny #DF-0248. Seed FV/41/10/2026 pozostaje
powiązany z #DF-0243 (BMW X3 w aktualnym seedzie); nie zmieniamy danych auta tylko
po to, aby dopasować podpis Figmy. Kwoty i VAT liczymy przez Decimal, HALF_UP
do grosza na pozycję. Pola akceptują przecinek, rabat 0–100%, ilość > 0.
Nabywca wymaga adresu, kodu pocztowego, e-maila, a firma także sumy kontrolnej NIP.
Szkic localStorage zawiera studioId, userId i środowisko; odczyt jest walidowany.

To issue UI, bez nowego backendu wystawiania, numeracji, korekt, płatności lub maila.
Potwierdzenia w wizardzie i szczegółach jawnie opisują demonstrację; nie zmieniają
bazy i nie wywołują MF. Historia bazowa pochodzi z KsefEvent, a akcje demo dodają
wyłącznie nietrwałe wpisy oznaczone „demo”. Numer i historia seeda nie są dowodem
walidacji rzeczywistej integracji.

PDF używa wersji do druku (wybór „Zapisz jako PDF” w przeglądarce), zawierającej
środowisko, oznaczenie demonstracji i datę wysłania PDF. QR jest oryginalną ilustracją
z Figmy 72 × 72, podpisaną jako demonstracja; nie jest kodem weryfikacyjnym MF.
UPO pobiera zapisany `ksefUpoXml`, jeśli istnieje. Seed nie zawiera UPO, więc
przycisk wyświetla informację o niedostępności. XML faktury analogicznie informuje
o braku generatora w tym zakresie. Brak integracji MF i żadnych zmian Stripe.

Testy obejmują obliczenia, blokady kroków, autosave, potwierdzenie płatności demo,
PROD bez badge testowego oraz rzeczywistą izolację odczytów między dwoma studiami
i pomiędzy identycznymi numerami faktur TEST/PROD w Postgresie.

## Mobile M-07 / M-08 (#48)

- `/invoices` poniżej 1024 px używa kart M-07, tych samych rekordów, filtrów,
  wyszukiwania, paginacji i środowiska co desktop. Link do FV zachowuje `env`.
- `/invoices/[number]` pokazuje kwotę, status, KSeF, pozycje i stały pasek akcji
  M-08. Kopiowanie, UPO, drukowanie PDF i potwierdzenia korzystają ze wspólnej
  obsługi `InvoiceDetails`. Historia i pozostałe akcje są pod przyciskiem „Więcej”.
- Wysyłka PDF nadal jest demonstracją UI (jak D-09). Płatność i korekta zapisują
  dane (#45, niżej); generator PDF/XML to #43, adapter KSeF to #44.
- TEST i PROD pozostają rozdzielone przez istniejące zapytania i parametr `env`.
  Nie dodano mobilnego API ani zapytań do danych faktur.
- Źródła: [M-07](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=32-671),
  [M-08](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=32-784).

## PDF i FA(3) — #43

D-09 i M-08 pobierają rzeczywiste dokumenty przez
`GET /api/studios/[studioId]/invoices/[invoiceId]/pdf?env=test` lub `/xml?env=test`.
`env` jest obowiązkowy (`test` / `production`); zapytanie łączy ID, studio i środowisko.
Wymagane jest `invoices:manage`. Odpowiedzi są załącznikami z `private, no-store`.
Eksport nie ustawia `emailedAt`: pobranie nie jest wysłaniem wiadomości.
Data na PDF pochodzi z zapisanego `emailedAt`, a przy jej braku jest „nie wysłano”.
Przycisk kolejnej wysyłki zachowuje nazwę „Wyślij ponownie”. Wysyłka e-mail,
płatności i korekty pozostają dotychczasową demonstracją; nie dodano HTTP do MF.

`src/invoices/pdf.ts` używa react-pdf, A4 i lokalnego Inter z polskimi znakami.
Zachowuje strukturę papieru D-09: strony transakcji, daty, pozycje, podsumowanie,
numer KSeF i datę wysłania. Font jest uwzględniony w standalone Next.
Nie osadza demonstracyjnego QR jako kodu weryfikacyjnego. Rzeczywisty QR wymaga
hasha XML faktycznie wysłanego do KSeF; zapis tego dokumentu należy do adaptera #44.

Oba generatory używają zapisanych InvoiceItem.net/vat/gross i sum faktury.
Wspólna walidacja Decimal odrzuca niepełne daty, szkice, niezakończone zlecenia,
ułamki grosza, niezgodne pozycje/sumy oraz brutto różne od brutto zlecenia (409).
Nie naprawia kwot eksportem ani nie wyprowadza ponownie netto z brutto.
XML obejmuje zwykłą krajową fakturę VAT w PLN (23%, 8%, 5%, 0% krajowe),
nabywcę z NIP albo konsumenta z BrakID. Korekty opisano w #121 niżej; zwolnienia
i transakcje zagraniczne wymagają osobnego mapowania. Sprzedawca pochodzi z konfiguracji studia,
nabywca i kwoty z zapisanego snapshotu faktury.

Testy: `pnpm vitest run src/ksef/fa3.test.ts src/invoices/pdf.test.ts`;
integracja z Postgres: `pnpm vitest run src/server/faktury/document.test.ts`.
Walidacja XSD jest obowiązkowa: lokalnie potrzebny `xmllint` (macOS: systemowy,
Linux: `libxml2-utils`), instalowany też w CI. Test nie pomija braku walidatora.

## Wystawianie, korekta i „opłacona” — #45

[D-09 akcje](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=22-640).
Logika: `src/server/faktury/manage.ts`. Wszystkie trasy wymagają `invoices:manage`,
sprawdzają Origin i działają przez `studioDb(studioId)`.

- `POST /api/studios/[studioId]/invoices` wystawia FV. **Tylko ze zlecenia `completed`
  z datą zakończenia**: `#DF-0248` (w trakcie), przyjęte, do odbioru i anulowane dają 409,
  zakończone `#DF-0243` przechodzi. Jedna aktywna FV na zlecenie w danym środowisku (zmiany
  idą korektą), suma brutto musi równać się kwocie zlecenia (jak wymaga eksport z #43).
  Środowisko KSeF pochodzi z konfiguracji studia, nie z żądania. Rabat złóż w cenie netto.
- Numeracja `FV/n/MM/RRRR` (korekta `KFV/n/MM/RRRR`): licznik `InvoiceCounter` osobno dla
  studia, środowiska, rodzaju i roku; brakujący startuje od najwyższego istniejącego
  numeru (seed `FV/41` → następna `FV/42`). Wystawianie jest `Serializable`, równoległe
  próby dają 409 zamiast duplikatu.
- `POST …/invoices/[invoiceId]/corrections` wystawia korektę: osobny `Invoice`
  `kind = correction` z `correctsInvoiceId` (CHECK w bazie), ten sam nabywca i środowisko.
  Wymaga faktury wystawionej i przyjętej w KSeF. Body: `reason` + pozycje po korekcie
  (`lp`, `quantity`, `unitNet`; ilość 0 usuwa pozycję, pominięte bez zmian). Kwoty
  dokumentu to **różnica** (mogą być ujemne), kolejna korekta liczy od stanu po poprzedniej.
  Korekty korekty nie ma; korekta nie jest „nieopłaconą fakturą” na liście.
- `POST …/invoices/[invoiceId]/paid` ustawia `paidAt` (przelew; opcjonalne `paidAt` ISO,
  nie z przyszłości i nie przed wystawieniem). Atomowe: drugi klik daje 409 i nie
  nadpisuje daty. „Status paid” to pochodna `paidAt`, bez nowej wartości enuma.
  Płatność jest niezależna od KSeF i od Stripe Checkout (poza v1).

PDF i FA(3) korekty obsługuje mapowanie #121 opisane niżej. Podpięcie wizarda D-08 do POST
wystawiania opisano w #118, niżej.

Testy: `pnpm vitest run src/server/faktury/manage.test.ts` (Postgres: blokada
niezakończonych zleceń, numeracja TEST/PROD, wyścigi, izolacja studiów) oraz
`components/faktury/*.test.tsx`.

## Zapis kreatora — #118

D-08 wywołuje istniejący POST wystawiania z `workOrderId`, nabywcą,
pozycjami i `dueDays: 7`. E-mail pozostaje w szkicu; ten endpoint go nie zapisuje
ani nie wysyła PDF. Rabat jest składany w cenę jednostkową netto z zaokrągleniem
HALF_UP do grosza; podgląd i payload używają identycznych cen i Decimal.
Środowisko bierze serwer z aktywnego studia. Po 201 szkic jest usuwany,
a nawigacja otwiera otrzymany numer i środowisko. Podczas zapisu formularz
jest zablokowany; synchroniczna blokada chroni również przed drugim kliknięciem.
Błędy 400/409 zostają przy formularzu i zachowują szkic. API nadal sprawdza
zakończenie zlecenia, zgodność brutto i brak istniejącej faktury w transakcji.
Wysyłka do KSeF i mail nie należą do potwierdzenia wystawienia.

## Wysyłka KSeF — #119

D-09/M-08 mają wspólny przycisk „Wyślij do KSeF” dla wystawionej faktury
`not_sent`. POST `/api/studios/:studioId/invoices/:invoiceId/ksef` wymaga
owner/manager, poprawnego Origin i zakończonego zlecenia. Środowisko pochodzi
z faktury; body nie wybiera TEST/PROD ani XML. Token zapisuje właściciel w
`/settings`; lista i szczegóły zawierają link do ustawień.

Przed kolejką generujemy FA(3) z danych dokumentu i walidujemy lokalnym XSD
przez `xmllint --nonet`. Docker zawiera walidator i przypięte schematy.
Snapshot XML i historia powstają w transakcji przed enqueue; istniejący outbox
odtwarza enqueue przy awarii Redisa. UI pokazuje `queued`, wpis historii i błędy
409, bez tokenu i diagnostyki XML. Korekty używają mapowania #121;
mail PDF opisano niżej. Offline nie jest dostępny.

### E-mail z PDF

D-09 i M-08 zlecają `POST /api/studios/:studioId/invoices/:invoiceId/email`
z `{ env }`. Uprawnienie `invoices:manage`, Origin i zakres studia obowiązują
jak przy pozostałych akcjach. Adres pochodzi z e-maila klienta powiązanego
z fakturą i jest zapisywany w outboxie przy zleceniu. Brak poprawnego adresu
zwraca 400. Korekty czekają na osobny generator PDF (#121).

Worker obsługuje `InvoiceMail` co 15 sekund. Oczekujące kliknięcia współdzielą
jedno zadanie; po udanej wysyłce „Wyślij ponownie” tworzy kolejny wpis.
`emailedAt` oznacza przyjęcie przez SMTP, nie potwierdzenie odczytania ani
ostatecznego doręczenia. Błąd SMTP pozostawia zadanie do retry (do godziny
odstępu), bez usuwania daty poprzedniej udanej wysyłki. Bez SMTP w dev worker
loguje samą treść podglądu i pozostawia zadanie jako niewysłane; w produkcji
czeka na konfigurację. Mail zawiera tylko PDF, bez XML i linku portalu.
Dokumenty TEST są oznaczone w temacie, treści i nazwie załącznika.

Wysyłka SMTP jest at-least-once: awaria po przyjęciu przez SMTP, przed zapisem
transakcji może spowodować powtórkę. Każde zadanie zachowuje stały Message-ID.


## Eksport korekty — #121

PDF i XML obsługują `kind=correction`. Dokument wskazuje pierwotną FV (nigdy
inną korektę), powód i zapisane różnice netto/VAT/brutto, również ujemne.
Ilość i cena w rekordach korekty opisują stan po zmianie, dlatego nie służą do
ponownego liczenia różnic. PDF ma kolumny różnic; FA(3) używa `KOR`,
`PrzyczynaKorekty`, `DaneFaKorygowanej` oraz różnic w `P_11` i podsumowaniach.
Brak numeru KSeF pierwotnej FV blokuje XML komunikatem 409. Nie jest traktowany
jako dowód wystawienia poza KSeF. Walidacja XSD pozostaje taka jak dla VAT.

Odczyt źródła jest ograniczony do tego samego studia i środowiska; walidacja
wymaga zgodności nabywcy. Pobranie ani eksport nie zmieniają `emailedAt`.
Generator PDF jest również używany przez outbox maila z #120.
