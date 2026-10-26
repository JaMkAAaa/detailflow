# D-02 — kalendarz zasobowy (#28)

Referencja: [Figma D-02](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=5-10).

`/calendar` korzysta z istniejącego autoryzowanego shellu; `/kalendarz` przekierowuje
na ten adres. To ekran UI z jawnym scenariuszem demo 24.10.2026, godz. 11:30,
bez zapytań operacyjnych. Inne dni są puste. Linia czasu jest częścią scenariusza.
Filtr osób i widok tygodnia działają lokalnie. Nakładające się przedziały są
rozdzielane na kolumny w obrębie boksu; stykające się terminy nie kolidują.

Bloki mają href `/orders/DF-…` do podłączenia karty zlecenia w 5.3. Kreator
rezerwacji jest komunikatem „wkrótce”, tak jak istniejące kreatory pulpitu.
Brak nowych assetów: ekran używa istniejącego shellu, Button, Badge i tokenów.
