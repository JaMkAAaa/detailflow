# D-01 Pulpit — #26

Referencja: [D-01 / Przegląd dnia](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=1-3).
Widok desktopowy 1280+, na istniejącym shellu studia.

Dane są stałym scenariuszem demonstracyjnym z 24.10.2026, godz. 11:30.
Nie odczytujemy danych operacyjnych ani nie liczymy KPI z bazy (zakres #27).
Siedem aktywnych w istniejącym seedzie to 3 w trakcie, 2 do odbioru i 2 przyjęte.
Tabela D-01 pokazuje osobny wycinek: 6 pozycji na dziś, w tym zaplanowane BMW M4.
Porsche #DF-0248 pozostaje na etapie 2/4; CTA faktury nie wystawia dokumentu
z aktywnego zlecenia. Kwoty w mocku to stringi dziesiętne PLN.

Filtry tabeli działają również klawiaturą. Lista obsługuje pusty dzień i brak
wyników. Plan pozwala przejść do innego dnia, zobaczyć pusty stan i wrócić do
dnia demonstracyjnego. Linia „teraz” odnosi się do stałego czasu scenariusza.

Linki do kalendarza, zleceń, klientów i faktur prowadzą do istniejących tras.
Kreatory, szczegóły zlecenia i portal klienta należą do kolejnych issue;
powiązane akcje otwierają dialog „wkrótce”, zamykany przyciskiem lub Escape,
z natywnym zarządzaniem focusem. Nie tworzą dokumentów i nie udają wysyłki.
Alert magazynowy jest wyłącznie elementem makiety D-01, bez modułu magazynu.

Zdjęcie to eksport warstwy fotografii `3:203` z kadrem Figmy (338×155).
Cztery SVG wykresów to oryginalne warstwy D-01 z zachowanymi wymiarami root.
Nie ma zewnętrznych tymczasowych URL-i ani animacji. Istniejący shell
(np. aktywna pozycja sidebara, picker i zaproszenia) pozostaje poza #26.

Weryfikacja: `pnpm exec vitest run components/pulpit/dashboard.test.tsx`,
`pnpm typecheck`, `pnpm lint`, `pnpm build` oraz porównanie z eksportem D-01.
