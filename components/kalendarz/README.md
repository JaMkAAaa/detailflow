# D-02 — kalendarz zasobowy (#28)

Referencja: [Figma D-02](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-10).

`/calendar` korzysta z autoryzowanego shellu i danych wybranego studia;
`/kalendarz` przekierowuje na ten adres. Bieżąca data i terminy są wyświetlane
w Europe/Warsaw. Widok dnia i tygodnia obsługuje nawigację oraz rezerwacje
wielodniowe. Boksy pochodzą z bazy. Model nie zawiera przypisania pracownika,
więc filtr pokazuje jedynie „Wszystkie osoby”.

„Nowa rezerwacja” otwiera formularz dla istniejących zleceń. Można dodać,
zmienić lub usunąć przydział boksu. Błąd kolizji z API jest widoczny w formularzu.
Kontrakt API i testy: `src/server/kalendarz/README.md`.

`DayGrid` bez propsów zachowuje scenariusz demo 24.10.2026 dla testów UI.
Bloki mają href `/orders/:id` do podłączenia karty zlecenia w 5.3.
Brak nowych assetów: ekran używa istniejącego shellu, Button, Badge i tokenów.

---

# M-02 — dzień boksów na telefonie (#47)

Referencja: [Figma M-02](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=19-397).

`/calendar` renderuje `MobileDayView` poniżej `lg` i `DayGrid` powyżej (CSS, jak M-01).
Oba dostają te same dane z serwera; reguły dnia są wspólne w `demo.ts`
(`bookingsOnDay`, `bookingHref`), więc telefon nie liczy niczego po swojemu.

- Pasek tygodnia (Pn–Nd, kropka = dzień z rezerwacją), filtr „Wszystkie / Boks 01 / Boks 02”
  z boksów studia, strzałki tygodnia i „Wróć do dziś” — odpowiednik nawigacji D-02.
- Lista chronologiczna z linią „teraz” (czas Europe/Warsaw). „Wolne … · Boks N” to okno
  *między* rezerwacjami jednego boksu, ≥ 60 min, które jeszcze się nie skończyło
  (`freeWindows`); dotknięcie otwiera sheet rezerwacji z tym samym `BookingForm`.
- Bloki prowadzą do `/orders/:numer`. `Booking.number` jest nowe — wcześniej desktop linkował
  po `id` z bazy, co nie pasuje do trasy zlecenia (dotyczy też `DayGrid`).

Odstępstwa od Figmy: status wszystkich kart to „● W trakcie / ○ Zaplanowane” (Figma miesza
plakietkę i tekst); lupa jest nieaktywna jak w M-01; dodany „Nowa rezerwacja”, bo bez okna
≥ 60 min nie byłoby jak otworzyć formularza; w karcie jest usługa z danych, nie skrót z makiety.
