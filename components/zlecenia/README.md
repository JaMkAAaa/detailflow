# D-04 — szczegóły zlecenia (#32)

Referencja: [Figma D-04](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-12).

Trasa kanoniczna to `/orders/[number]` (z nią zgadzają się sidebar, okruszki,
dokumentacja §13 i bloki kalendarza D-02). `/zlecenia/[number]` z issue
przekierowuje na nią, tak jak `/kalendarz` → `/calendar`. Nieznany numer daje 404.

Ekran jest UI-only z jawnym scenariuszem demo `#DF-0248` (24.10.2026, 11:30),
bez zapytań operacyjnych — jak D-02. Kwoty to stringi PLN (`Decimal` w
modelu), formatowane przez `formatPln`. Dane wyceny i etapów zgadzają się z `prisma/seed.ts`.
Dostęp do studia zapewnia `requireStudio()` w layoucie `(studio)`.

Zakładki (`?tab=zdjecia|stan-auta|historia`, domyślnie Przegląd) działają jako
ARIA tabs ze strzałkami/Home/End; wybór trafia do URL przez `replaceState`.

- **Przegląd** — jak Figma: dokumentacja, protokół przyjęcia, postęp **4 etapów
  studia** (portal ma 3), wycena, kontakt.
- **Zdjęcia, Stan auta, Historia** — luka prototypu, zbudowane tu. W Figmie jest
  tylko jedno zdjęcie (#12); pozostałe kafelki mają jawny placeholder „Podgląd
  niedostępny w demo”, bez powielania cudzych fotografii.

Zmiana etapu, link dla klienta, dodawanie zdjęć i karta klienta otwierają
dialog „wkrótce” — nic nie jest zapisywane ani wysyłane. Podłączenie danych
(modele zdjęć, protokołu i historii zdarzeń, token portalu, zapis etapu) należy
do issue `type:implement`. Pulpit nadal pokazuje dialog zamiast linku do tego ekranu.

Breadcrumb „Studio / Zlecenia” pochodzi ze wspólnego shellu; Figma pokazuje
„Studio / Porsche Panamera” — wymaga zmiany Topbara, poza zakresem tego issue.

---

# D-03 — tablica zleceń (#30)

Referencja: [Figma D-03](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-11).

`/orders` renderuje `OrdersBoard` w istniejącym autoryzowanym shellu; `/zlecenia`
przekierowuje na ten adres (jak `/kalendarz` → `/calendar`). To ekran UI na danych
demo (`board-demo.ts`, scenariusz 24.10.2026, 11:30) — bez zapytań operacyjnych, więc bez
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
