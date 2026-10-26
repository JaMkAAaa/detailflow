# Detailflow — panel właściciela platformy

Figma: https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=118-171

Strona: `07 Detailflow / Panel właściciela` (`116:10`). Wszystkie wartości, osoby, incydenty i zdarzenia są danymi demonstracyjnymi. To projekt UX/UI, nie podłączony system administracyjny.

## Widoki

| Widok | ID | Zakres |
| --- | --- | --- |
| A-01 Przegląd platformy | 118:171 | MRR, konta, triale, aktywność, zadania do reakcji, trend i aktywacja. |
| A-02 Lista studiów | 118:359 | Wyszukiwanie, status konta, plan, ostatnia aktywność i abonament. |
| A-03 Karta studia | 119:282 | Kontakt, aktywność, limity, rozliczenie, zdarzenia i narzędzia dostępu. |
| A-04 Abonamenty i przychody | 119:477 | Skład MRR, wpływy, zaległości, odejścia i koszty działania. |
| A-05 Analityka produktu | 120:396 | Aktywacja, konwersja, retencja kohortowa, wykorzystanie funkcji. |
| A-06 System i KSeF | 120:614 | Kondycja usług, opóźnienia, kolejka, incydent i kategorie błędów. |
| A-07 Wsparcie | 121:508 | Kolejka zgłoszeń, SLA, rozmowa ze studiem i kontekst konta. |
| A-08 Administracja | 121:661 | Role operatorów, MFA, wdrażanie funkcji i audyt. |
| A-09 Sesja wsparcia | 122:623 | Powód, zgłoszenie, zakres tylko do odczytu i limit 15 min. |
| A-10 Zawieszenie konta | 122:645 | Konsekwencje, powód, potwierdzenie nazwy; przycisk nieaktywny przy pustych danych. |

Wspólny komponent menu administratora: `117:457`, 7 wariantów. Ekrany korzystają z istniejącego logo, przycisków i zmiennych kolorystycznych Detailflow. Są oddzielone od panelu operacyjnego studia.

## Definicje i spójność metryk

- Stan: 26.10.2026, 11:30. Kwoty abonamentów netto w PLN.
- Wszystkie studia: 166 = 128 aktywnych płacących + 24 triale + 6 z zaległością + 8 wstrzymanych. Są to rozłączne grupy na potrzeby tej makiety.
- MRR w tym projekcie to wartość miesięczna aktywnych abonamentów. Wyklucza triale, konta z zaległością i konta wstrzymane. Nie jest sumą faktycznie pobranych płatności.
- Solo: 64 × 79 zł = 5 056 zł; Studio: 48 × 149 zł = 7 152 zł; Pro: 16 × 279 zł = 4 464 zł. Razem: 128 kont i 16 672 zł.
- Wrzesień: 14 920 zł MRR. Wzrost: 1 752 zł, czyli 11,7% po zaokrągleniu.
- Płacące studia: 118 na początku okresu + 15 nowych − 5 odejść = 128. Churn kont: 5 / 118 = 4,2%.
- Zaległości: 6 × 149 zł = 894 zł. Wpływy 14 980 zł obejmują pobrane płatności netto od 1 do 26 października.
- Aktywne studio: przynajmniej jedno utworzone lub zaktualizowane zlecenie w danym tygodniu. 112 / 128 = 87,5%.
- Aktywny użytkownik: przynajmniej jedno zdarzenie modyfikujące dane w ostatnich 7 dniach; 294 z 382 użytkowników.
- Aktywacja: co najmniej 3 zlecenia w pierwszych 7 dniach od rejestracji. 24 / 40 = 60%. W implementacji mianownik musi obejmować tylko konta z pełnym oknem obserwacji.
- Konwersja triala: 9 płatnych kont / 30 zakończonych triali = 30%. To inny mianownik niż bieżące 24 triale i 40 rejestracji.
- Retencja kohortowa: odsetek kont z aktywnością zleceniową w danym tygodniu. Brak pełnego okna obserwacji pokazujemy jako „—”, nie 0%.
- Koszty operacyjne demo: 1 860 infrastruktura + 1 300 SMS i e-mail + 1 100 wsparcie = 4 260 zł. Marża po tych kosztach: 74,4%; bez podatków i pozostałych kosztów.
- Aktywność Obsidian Studio: 18 + 24 + 20 + 24 = 86 zleceń w czterech tygodniach.
- KSeF TEST: 828 przyjętych + 9 błędów danych + 5 oczekujących = 842, czyli 98,3% przyjętych po zaokrągleniu. TEST i produkcja muszą mieć oddzielne filtry i mianowniki.

## Interakcje i granice projektu

- Podłączono 62 przejścia menu i kontekstowe oraz 2 przyciski Anuluj, łącznie 64 akcje prototypu.
- Punkt startowy: A-01. Powiązano menu, alerty pulpitu, listę → kartę Obsidian Studio, powrót, zgłoszenie → konto oraz otwieranie obu dialogów.
- Sprawdzono referencje i granice tekstów oraz obejrzano wszystkie 10 widoków na zrzutach. Nie przeprowadzono testu klikania w trybie Present.
- Eksporty, wyszukiwanie, przełączanie filtrów, odpowiedzi, zaproszenia, zmiana wdrożenia i potwierdzenia są zaprojektowanymi kontrolkami; nie wykonują operacji na prawdziwych danych.
- Przy pustej odpowiedzi i pustym potwierdzeniu zawieszenia przyciski są nieaktywne.
- Sesja wsparcia jest osobnym, audytowanym trybem tylko do odczytu. Nie przewidziano swobodnego, niejawnego logowania jako właściciel studia.
- Projekt obejmuje desktop. Mobilne odpowiedniki panelu właściciela nie zostały objęte tą iteracją.
