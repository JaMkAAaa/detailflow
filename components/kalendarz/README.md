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
