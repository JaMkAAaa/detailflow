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
