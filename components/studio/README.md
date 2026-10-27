# Shell studia — #21

Referencje: [Sidebar](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=92-2384),
[D-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=1-3).

Sidebar jest przytwierdzony do lewej krawędzi (`fixed`, 220 px, `100dvh`).
Menu i pomoc przewijają się niezależnie; profil i link „Wyloguj” pozostają
przy dolnej krawędzi viewportu. „Wyloguj” prowadzi do istniejącego `/logout`
z potwierdzeniem i wylogowaniem przez Server Action (POST). Workspace ma
odstęp 220 px od lewej, aby treść nie wchodziła pod sidebar.

Layout desktopowy ma sidebar 220 px, topbar 72 px + separator 1 px oraz
workspace z paddingiem 28 px. Przy 1440×1100 workspace ma 1220 px szerokości.
Aktywny link używa `--df-lime-dark` i `--df-lime`, zgodnie z kryteriami issue.
Ikony SVG w `public/studio` pochodzą z Figmy (18×18); maska CSS nadaje im
kolor pozycji menu. Brand korzysta z istniejącego `LogoMark` i fontu Space Grotesk.

Pięć tras zawiera na razie tylko nagłówki dla czytników ekranu, aby można było
sprawdzić warianty nawigacji. Treść ekranów należy do kolejnych issue.
Aktywność obejmuje też podstrony, np. `/orders/DF-0248`.
Usługi i cennik, Magazyn, Statystyki oraz Portfolio są natywnie disabled
i mają widoczny badge „Wkrótce”. Nie generują nawigacji.

Picker ma jedno demonstracyjne studio Obsidian, a profil — Michała Kowalskiego.
Sesja i przełączanie tenantów wymagają osobnego wdrożenia. Wyszukiwarka ⌘K
jest nieaktywnym placeholderem. Shell nie wykonuje zapytań do bazy.

---

# Tab bar mobilny + M-01 — #46

Referencje: [Tab bar](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=92-3347),
[M-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=19-254).

Poniżej `lg` (1024 px) layout `(studio)` chowa sidebar i topbar, a `TabBar`
(`fixed`, dół ekranu, `env(safe-area-inset-bottom)`) pokazuje: Pulpit, Kalendarz,
**+**, Zlecenia, Więcej. Powyżej `lg` nic się nie zmienia. Wcześniejszy
`min-w-[1024px]` shellu został usunięty; ekrany bez wersji mobilnej (np. tablica
zleceń, M-03) nadal przewijają się poziomo — dostaną własne issue.

- **+** otwiera sheet (natywny `<dialog>`, `Sheet.tsx`) z „Nowe zlecenie” i „Nowa
  wycena”. Obie akcje pokazują „dostępne wkrótce” — kreatory to osobne issue (M-05).
- **Więcej** to tymczasowo sheet z linkami do istniejących tras (Faktury, Klienci
  i auta, Zaproś do studia, Wyloguj); M-06 zastąpi go ekranem. Pracownik nie widzi
  Faktur ani zaproszeń, jak w sidebarze. Zakładka świeci się na `/invoices`,
  `/customers`, `/team`.
- Animacja sheetu tylko przy `prefers-reduced-motion: no-preference`.

Pulpit mobilny: `components/pulpit/mobile-dashboard.tsx`, te same dane co D-01
(`getDashboardMetrics`, `studioDb`). `page.tsx` renderuje obie wersje i przełącza je
CSS-em (`lg:hidden` / `hidden lg:block`), bez migotania po hydracji.
Odstępstwa od Figmy:

- Brak karty „Niski stan: CarPro CQuartz” — magazyn jest poza v1. W jej miejsce
  te same alerty co w D-01 (serwis ceramiki, odrzucone faktury KSeF z TEST/PROD).
- Brak zdjęcia auta: nie ma jeszcze zdjęcia z danych, a pulpit nie pokazuje cudzej
  fotografii. Jest placeholder 150 px.
- Etap „Dalej: …” bez czasu trwania („· 4 h”) — model go nie ma.
- Lista „Dzisiejsze zlecenia” pomija auto z karty „Na warsztacie”.
- „Zakończ: …” i „Zdjęcie” otwierają sheet „wkrótce” (issue `type:ui`); zapis etapu
  i upload zdjęć (#33) podłączy osobny krok `type:implement`.
- Dzwonek powiadomień jest nieaktywny, jak wyszukiwarka w topbarze.
- Obłożenie to wartość policzona z seeda/dnia (definicja w README pulpitu), więc
  nie musi wynosić 82% z makiety.
