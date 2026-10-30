# Detailflow — zakres prototypu po audycie

Aktualizacja: 26.10.2026. Plik Figma: https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S

## Strony i ekrany

| Strona | Zawartość |
| --- | --- |
| 00 Okładka | Indeks z linkami, status projektu i legenda prefiksów. Ramka `96:2`. |
| 01 Brand i komponenty | B-01 wybrany Flowcut, B-02 archiwum Flowline/Orbit, komponenty nawigacji, przycisków, statusów, ikon, logo, skeletonów i Preview. Strona `93:2732`. |
| 02 Aplikacja — desktop | D-01–D-10 w sekcjach A–F: Pulpit, Kalendarz, Zlecenia, Klienci, Wyceny, Faktury. Sekcja G zawiera moduły TODO. Strona `93:2733`. |
| 03 Aplikacja — mobile | M-01–M-08 w jednym rzędzie. Strona `93:2734`. |
| 04 Portal klienta | P-01 status zlecenia, P-02 odnośnik do gotowego stanu wygasłego linku, TODO akceptacji wyceny. Strona `93:2735`. |
| 05 Stany i wzorce | S-01 puste i błędy (`17:254`), S-02 interakcje (`81:756`), S-03 zakres (`81:728`). Strona `93:2736`. |
| 06 Landing — detailflow.pl | L-01 desktop, L-02 mobile, L-03 menu landingu. Strona `93:2737`. |
| 07 Detailflow / Panel właściciela | A-01–A-08: przegląd SaaS, studia, karta konta, abonamenty, analityka produktu, system, wsparcie i administracja. A-09–A-10: dialogi dostępu. Strona `116:10`. |

Nazwy ekranów mają format `[prefiks]-[nr] Moduł / Ekran — wariant`. Zachowano identyfikatory istniejących ekranów i ich bieżące rozmiary, w tym większe wysokości po poprawkach audytu. Odstęp rzędów dostosowano do pulpitu 1280 px.

Panel właściciela platformy używa prefiksu A i stanowi odrębny obszar administracyjny. Definicje jego metryk, identyfikatory ekranów i granice prototypu opisuje `audit/admin/README.md`. Wszystkie liczby na tej stronie są danymi demonstracyjnymi.

Komponenty wspólne:

- Sidebar: 5 wariantów aktywnej pozycji, 10 ekranów aplikacji zastąpionych instancjami (`92:2384`).
- Tab bar: 4 warianty, 5 ekranów aplikacji zastąpionych instancjami (`92:3346`).
- Status / Badge: 9 wariantów, 41 wcześniejszych plakietek zastąpionych instancjami (`92:3540`).
- Button states: 10 wariantów Primary/Secondary × Default/Hover/Focus/Disabled/Loading (`82:728`).
- Preview: pięć komponentów prezentacyjnych. Podglądy pulpitu i faktury korzystają również ze wspólnego sidebara, a mobilny pulpit ze wspólnego tab bara.

Połączenia wewnątrz strony pozostają natywnymi przejściami prototypu. Przejścia między stronami, np. panel → portal klienta, otwierają wskazany prototyp w nowej karcie. Kontrola referencji nie wykazała nieistniejących ani międzystronicowych celów akcji NODE.

## Reguły danych demonstracyjnych

- Bieżący stan: 24.10.2026, 11:30.
- Aktywne = 7: 3 w trakcie, 2 do odbioru, 2 przyjęte. Zakończone są liczone osobno.
- Porsche #DF-0248 pozostaje w trakcie, etap 2 z 4.
- FV/41 powstaje z innego, zakończonego zlecenia tego klienta: #DF-0243 z 23.10.2026. Nie jest fakturą za aktualne #DF-0248.
- Wystawienie FV/41: 24.10, 10:12:08; przyjęcie testowe: 10:13:08; czas do przyjęcia: 60 s.
- Kwota po terminie: 3 450 zł. Wszystkie nieopłacone: 8 250 zł (z FV/41).
- Fakturę przygotowuje się po zakończeniu zlecenia.
- Dokumenty KSeF są demonstracją środowiska testowego. Numery i przebieg zdarzeń nie są dowodem poprawności rzeczywistej integracji.
- PDF ma widoczną informację o dacie wysyłki; kolejna wysyłka ma nazwę „Wyślij ponownie”.
- Portal upraszcza cztery etapy studia do trzech; ostatni obejmuje powłokę i kontrolę.

## Do zaprojektowania

Przed uznaniem prototypu za kompletny wymagane są:

- Wycena: krok 1 — klient i auto; krok 3 — termin, podgląd i potwierdzenie wysyłki.
- Faktura: krok 1 — nabywca; krok 3 — podgląd i potwierdzenie wysyłki.
- Osobne zakładki zlecenia: Zdjęcia, Stan auta, Historia.
- Portal: ekran akceptacji wyceny i potwierdzenie decyzji.
- Mobilne rozszerzone opcje wyceny.

## Moduły po pierwotnym v1 — autoryzowane, wdrażane pojedynczo

Decyzja właściciela produktu z 29.10.2026 obejmuje wszystkie #142–#151. Dawne „Poza v1” nie oznacza braku zgody; zależności techniczne nadal obowiązują. #142–#145 są wdrożone; #146 jest etapem badania MF/dokumentacji, a kod offline i #151 pozostają niewdrożone. #150 dodaje eksport JPK_FA(4) z desktopowej listy faktur, z wyborem okresu, danymi urzędu i osobnym TEST/PROD; [kontrakt](docs/jpk-fa.md). #149 dodaje opcjonalny SMS z linkiem w kroku 3 kreatora wyceny, po potwierdzeniu zgody, tylko przy konfiguracji SMSAPI; [kontrakt](docs/sms-klienta.md). #147 scalono w PR #186. #148 ma implementację sandbox płatności klienta: Connect Standard + direct charges, prowizja 0%; [kontrakt i ograniczenia](docs/platnosci-klientow.md). Hosted smoke bez kluczy nie jest potwierdzony. #115 pozostaje otwarty.

Katalog Usługi i cennik jest ekranem studia (`/services`). Magazyn chemii (#143) jest ekranem `/inventory`: nazwa, jednostka (pełne sztuki/ml), ilość, próg niskiego stanu i jawna korekta z kontrolą wersji; bez automatycznego zużycia przy zleceniu. Alert ilość ≤ próg pojawia się w D-01 i M-01. Wykorzystuje wzorce panelu i katalogu, bez osobnej gotowej ramki magazynu w prototypie. Statystyki studia (#144) są ekranem `/statistics` tylko dla ownera: przychód z zakończonych zleceń, udział usług i obłożenie boksów w zakresie dat Europe/Warsaw, z „Brak danych” zamiast zer; bez osobnej ramki w prototypie, na wzorcach kart i paneli pulpitu. Portfolio realizacji (#145) jest ekranem `/portfolio` (wzorzec kart studia, bez osobnej ramki w prototypie) i publiczną galerią `/realizacje/[slug]`. Studio samo oznacza zdjęcie; domyślnie nic nie jest publiczne, a brak zdjęć to pusty stan, nie 404. Pełne Ustawienia i Konto pozostają poza ukończonym zakresem i wchodzą osobnymi issue.

Tryb offline KSeF pozostaje wyłączony. #146 rozstrzyga najpierw zasady MF: [decyzja z 29.10.2026, źródła i plan](docs/ksef-offline-decyzja-mf.md). W tym issue nie powstaje klient, przycisk ani dialog. Implementacja wymaga osobnego późniejszego PR po komentarzu MF i zdjęciu `blocked`; ukończenie badania nie oznacza działającego offline.

## Marketing

Fikcyjne opinie, oceny, logotypy klientów i wyniki zastąpiono scenariuszami oraz możliwościami demonstracji. Cennik 79 / 149 / 279 zł jest koncepcją miesięcznej opłaty netto; opcja roczna #147 pokazuje pełne 790/1490/2790 PLN netto za rok z góry z corocznym odnowieniem. Kwoty ustalił OpenBot po delegacji użytkownika; [decyzja i kontrakt](docs/stripe-roczny-przygotowanie.md). Kalkulator jest estymacją, a nie pomiarem wyników klientów. Pozostałe obietnice oferty i regulaminy trzeba zatwierdzić przed publikacją.

Szkielety dokumentów prawnych są dostępne pod `/regulamin`, `/polityka-prywatnosci` i `/umowa-powierzenia`. Każda strona jest oznaczona jako projekt do zatwierdzenia prawnego i nie stanowi obowiązującego dokumentu.

## Interakcje i implementacja

- Neutralne zaznaczenia filtrów, limonka dla głównych akcji i prac w toku, zieleń dla przyjętych dokumentów testowych.
- Focus: 2 px z odstępem 2 px. Stany komponentów to wzorce projektowe; nie wszystkie kontrolki istniejących ekranów są już instancjami nowego zestawu.
- Skeletony są statycznymi wzorcami KPI, tabeli i kalendarza. Pulsowanie i respektowanie prefers-reduced-motion należą do implementacji.
- Kopiowanie do schowka, tooltipy, filtry, paginacja, wysyłka i zmiana stanu muszą zostać zaimplementowane w aplikacji. Figma pokazuje układ i wybrane przejścia, nie pełny działający produkt.
- Lista klientów: 20 wierszy na stronę, przewijany obszar tabeli, 7 stron dla 124 klientów.
- M3 zawiera wszystkie 7 aktywnych zleceń w przewijanej treści.
- Podglądy landingu są instancjami komponentów Preview. Są odświeżonymi kopiami ekranów aplikacji; późniejsze zmiany ekranów źródłowych trzeba przenieść do odpowiednich komponentów Preview. Synchronizacja ze źródłem nie jest automatyczna.

## Celowo niewykonane rozszerzenia audytu

- Nie zwiększano globalnie całej typografii Body/Label; wymaga to osobnej iteracji układów. Część tekstów Kanbanu powiększono do 13 px.
- Nie dodano działającego trybu offline ani jego modala; usunięto możliwość uruchomienia go z prototypu.
- Tooltip pełnego numeru KSeF jest wzorcem na planszy interakcji, a nie działającą obsługą schowka.
