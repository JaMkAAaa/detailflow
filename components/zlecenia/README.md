# D-03 — tablica zleceń (#30)

Referencja: [Figma D-03](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-11).

`/orders` renderuje `OrdersBoard` w istniejącym autoryzowanym shellu; `/zlecenia`
przekierowuje na ten adres (jak `/kalendarz` → `/calendar`). To ekran UI na danych
demo (`demo.ts`, scenariusz 24.10.2026, 11:30) — bez zapytań operacyjnych, więc bez
`studioDb`. Numery, statusy, usługi i kwoty odtwarzają `ORDERS` z `prisma/seed.ts`
(7 aktywnych + zakończone #DF-0244 = 8 w widoku). Kwoty to `Decimal`-stringi PLN.

- Cztery kolumny: Przyjęte / W trakcie / Do odbioru / Zakończone. Licznik kolumny
  to liczba widocznych w niej kart (po filtrach).
- Filtry: szukaj (auto, klient, numer), pracownik, usługa. Brak wyników →
  `NoResultsState` z „Wyczyść filtry”. Pracownik jest tylko w danych demo — seed
  zna na razie boks, nie osobę.
- Przełącznik Tablica / Lista pokazuje te same, przefiltrowane zlecenia. Widoku listy
  nie ma w Figmie D-03; jest oparty o tabelę z pulpitu i `Badge`
  (dodany wariant `accepted` — „Przyjęte”).
- DnD (`@dnd-kit/core`): tylko wskaźnik, start po 6 px, więc kliknięcie nadal
  otwiera kartę (Enter/Spacja też). Drop jest wizualny i nic nie zmienia — komunikat
  w pasku filtrów mówi, że zmiana statusu zapisze się w kolejnym etapie (5.2).
  Brak animacji, więc `prefers-reduced-motion` jest zachowane.
- Karta i „＋ Nowe/Dodaj zlecenie” pokazują dialog „wkrótce” (jak pulpit); karta
  zlecenia pojawi się w 5.3. Zdjęcie Porsche: `public/zlecenia/porsche.png` (2× slotu
  239 × 82 z Figmy).
- Tekst 13 px (Body) tam, gdzie Figma powiększyła Kanban: nazwisko, usługa, kwota,
  liczniki i przełącznik widoku. Wiersz terminu zostaje 11 px, jak w Figmie.
- Karta ma min. 186 px jak w Figmie; karta ze zdjęciem wychodzi ok. 9 px wyższa niż
  268 px z makiety (tam treść wchodzi w dolny padding).
