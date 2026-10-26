# Shell studia — #21

Referencje: [Sidebar](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=92-2384),
[D-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=1-3).

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
Mobilny tab bar pozostaje poza zakresem tego issue.
