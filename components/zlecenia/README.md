# D-04 — szczegóły zlecenia (#32)

Referencja: [Figma D-04](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-12).

Trasa kanoniczna to `/orders/[number]` (z nią zgadzają się sidebar, okruszki,
dokumentacja §13 i bloki kalendarza D-02). `/zlecenia/[number]` z issue
przekierowuje na nią, tak jak `/kalendarz` → `/calendar`. Nieznany numer daje 404.

Ekran odczytuje zlecenie z bazy przez API #117 po numerze lub ID; dane klienta,
auta, boksu, wyceny, protokołu i historii pochodzą z tego samego rekordu
operacyjnego. Kwoty są stringami PLN (`Decimal` w modelu), formatowanymi przez
`formatPln`. Dostęp do aktywnego studia zapewnia `requireStudio()`.

Zakładki (`?tab=zdjecia|stan-auta|historia`, domyślnie Przegląd) działają jako
ARIA tabs ze strzałkami/Home/End; wybór trafia do URL przez `replaceState`.

- **Przegląd** — dokumentacja, protokół przyjęcia, postęp **4 etapów studia**
  (portal ma 3), kwota zlecenia i kontakt. Brak zdjęć/protokołu pokazuje stan pusty.
- **Zdjęcia, Stan auta, Historia** — pokazują zapisane dane; upload zdjęć i edycja
  protokołu pozostają osobnymi zadaniami.

Zmiana etapu zapisuje się przez `POST /orders/:id/advance`. Karta klienta prowadzi
do `/customers/:clientId`; portal i dodawanie zdjęć pozostają poza tym krokiem.

Breadcrumb „Studio / Zlecenia” pochodzi ze wspólnego shellu; Figma pokazuje
„Studio / Porsche Panamera” — wymaga zmiany Topbara, poza zakresem tego issue.

---

# D-03 — tablica zleceń (#30)

Referencja: [Figma D-03](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-11).

`/orders` pobiera listę przez `GET /api/studios/:studioId/orders`; tworzenie i
zmiana statusu korzystają z endpointów #117. `/zlecenia` przekierowuje na ten adres.
Kwoty API są stringami `Decimal` w PLN.

- Kolumny: Przyjęte / W trakcie / Do odbioru / Zakończone / Anulowane. Licznik kolumny
  to liczba widocznych w niej kart (po filtrach).
- Filtry: szukaj (auto, klient, numer), usługa. Brak wyników → `NoResultsState`.
  Przypisanie pracownika nie jest częścią tego issue.
- Przełącznik Tablica / Lista pokazuje te same, przefiltrowane zlecenia. Widoku listy
  nie ma w Figmie D-03; jest oparty o tabelę z pulpitu i `Badge`
  (dodany wariant `accepted` — „Przyjęte”).
- DnD (`@dnd-kit/core`) zapisuje status przez API; błędne przejście cofa kartę
  i pokazuje błąd. Drop nie animuje; `prefers-reduced-motion` pozostaje respektowane.
- Karty otwierają szczegóły dla każdego numeru. Formularz tworzenia pobiera klientów,
  auta i usługi ze studia; kwotę wysyła jako decimal string.
- Tekst 13 px (Body) tam, gdzie Figma powiększyła Kanban: nazwisko, usługa, kwota,
  liczniki i przełącznik widoku. Wiersz terminu zostaje 11 px, jak w Figmie.
- Karta ma min. 186 px jak w Figmie; karta ze zdjęciem wychodzi ok. 9 px wyższa niż
  268 px z makiety (tam treść wchodzi w dolny padding).

---

# M-03 / M-04 — lista i szczegóły zlecenia na telefonie (#47)

Referencje: [M-03](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=19-531),
[M-04](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=20-254).

`/orders` i `/orders/[number]` renderują `MobileOrders` / `MobileOrderDetails` poniżej `lg`
i wersję desktopową powyżej (CSS). Oba widoki używają rekordów z API i bazy aktywnego studia.

- **M-03** pokazuje wszystkie aktywne zlecenia w jednej przewijanej treści strony (bez
  wysokości na „fold”, bez wirtualizacji). Grupy: W trakcie, Do odbioru, Przyjęte. Chipy statusu i szukajka (auto, klient, numer, rejestracja —
  `BoardOrder.plate` z seeda; dotyczy też wyszukiwania na tablicy) działają razem; brak wyników
  → `NoResultsState`. Każda karta linkuje do szczegółów zlecenia.
- **M-04**: zdjęcie (ostatnie z `photos`), numer/status, „Zadzwoń” (`tel:`), Link i Zdjęcie
  (sheet „wkrótce”), postęp **4 etapów studia** (portal ma 3), wycena w PLN z `formatPln`.
  Dolny pasek „Zakończ: …” zastępuje tab bar (`TabBar` chowa się na `/orders/:numer`).
  Zmiana etapu zapisuje się przez API; status odświeża się po mutacji.

Odstępstwa od Figmy: etapy, notatki i linia pojazdu pochodzą z danych D-04 („Aplikacja
ceramiki”, „WA 911PC · Boks 01” — model nie ma koloru i roku); „⋯” jest nieaktywne; pole
szukania ma 16 px, żeby iOS nie przybliżał strony po fokusie.
Ikony z Figmy: `public/mobile/*.svg` przez `MaskIcon` (kolor z `currentColor`).
