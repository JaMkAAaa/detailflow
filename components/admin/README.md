# Panel właściciela — A-01 + shell (#52)

Referencje: [A-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=118-171),
sidebar `117:457`, definicje w `audit/admin/README.md`.

Osobny layout `(platform)`: sidebar 220 px, 7 pozycji, badge roli
(`PLATFORM OWNER` / `SUPPORT` / `ADMIN`). Sesja operatora to inne cookie
(`df-plat`) niż sesja studia (`df`). Membership studia nie otwiera `/admin`.

A-01 liczy prawdziwe agregaty (`src/server/admin/overview.ts`): MRR tylko
`active`, konwersja = płatne / zakończone triale, aktywacja przy pełnym oknie
7 dni. Pozostałe trasy shellu mają nagłówki — treść A-02–A-08 to osobne issue.

Logowanie: `/admin/login`. Seed: `anna.nowak@detailflow.test` /
`platform-demo-2026`.
