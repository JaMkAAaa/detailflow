# Wizard wyceny — #37

Trasa `/quotes/new` (alias `/wyceny/nowa`, zgodnie z migracją tras #68).
Krok 2 odwzorowuje [D-06](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-14).
Kroki 1 i 3 korzystają z tych samych paneli, pól i tokenów `--df-*`.

Scenariusz UI jest demonstracyjny: Adam Nowak, Porsche Panamera, dwie usługi,
4000 × 1,20 × 1,00 = 4800 zł brutto, VAT 897,56 zł. Kwoty podglądu to
`Decimal`, zaokrąglane HALF_UP do grosza. Czasy katalogowe Figmy są dla auta
średniego; zmiana rozmiaru skaluje je względem ×1,20 (domyślnie 12 h).

Autosave zapisuje szkic po każdej zmianie w localStorage, pod kluczem zawierającym
studioId i userId. Odtwarzanie sprawdza wersję i strukturę przez Zod. Błąd pamięci
przeglądarki jest widoczny, a pusty katalog blokuje każde przejście do kroku 3.
Nie ma zapytań operacyjnych ani zmian modeli danych. Kalendarz zawiera terminy
demo; potwierdzenie jawnie informuje, że nie wysyła wiadomości i nie rezerwuje boksu.
Silnik domenowy to #36, zapis serwerowy i wysyłka to #38. Dane UI nie są
przeznaczone do operacyjnej wyceny rzeczywistych usług.
