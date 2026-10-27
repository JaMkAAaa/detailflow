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
Eksport JPK pokazuje informację o niedostępności, offline pozostaje wyłączony.
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
