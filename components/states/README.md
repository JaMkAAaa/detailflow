# Wspólne stany — #22

Źródła: [S-01](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=17-254),
[S-02](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=81-756).
Importuj z `@/components/states` — bez kopiowania komponentów do ekranów.

```tsx
import { EmptyState, NoResultsState, NetworkError, TableSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";

if (pending) return <TableSkeleton className="w-full" />;
if (error) return <NetworkError onRetry={reload} retrying={retrying} />;
if (filtered && !rows.length) return <NoResultsState onClearFilters={clearFilters} query={query} />;
if (!rows.length) return (
  <EmptyState title="Brak zleceń na dziś" description="Boksy są wolne. Dodaj pierwsze zlecenie."
    actions={<Button onClick={openOrderForm}>+ Nowe zlecenie</Button>} />
);
```

`EmptyState` jest treścią panelu S-01: odstęp 12 px, ikona 28 × 28 w kole
64 × 64, opis do 380 px, akcje zawijane na małych ekranach. Panel, nagłówek
modułu i filtry pozostają po stronie ekranu. `icon`, `description` i `actions`
przyjmują ReactNode; `title` nazywa sekcję. `headingLevel` dobiera poziom nagłówka.
Callbacki i stan pobierania przekazuje komponent klienta danego ekranu.

`NoResultsState` wymaga `onClearFilters`, ma opcjonalne `query`, `description`
i dodatkowe `actions`. `NetworkError` wymaga `onRetry`; ekran ustawia `retrying`
na cały czas operacji, blokując kolejne próby. Nie obiecuje lokalnego zapisu,
automatycznej synchronizacji ani ponawiania, których nie zapewnia warstwa danych.

`NotFoundState` jest użyty w `app/not-found.tsx`. Domyślny link prowadzi do `/`;
`href` i `linkLabel` pozwalają wybrać istniejącą trasę ekranu. Plansza S-01 nie
zawiera osobnej makiety 404 — komponent stosuje jej wspólny układ komunikatów.

`KpiSkeleton`, `TableSkeleton`, `CalendarSkeleton` odtwarzają geometrię S-02
(240 / 380 / 360 px, padding 16 px, gap 12 px, promień 12 px).
Każdy ma jeden opisany `role="status"` i `aria-busy`, a dekoracyjne bloki są ukryte
przed czytnikiem. Usuń skeleton po zakończeniu ładowania. `className="w-full"`
rozciąga go w kontenerze; `label` zmienia polską etykietę ładowania.
Sam `Skeleton` służy do składania innych wzorców we własnym regionie ładowania.

Puls istnieje wyłącznie w `prefers-reduced-motion: no-preference`
(`motion-safe:animate-pulse`). `motion-reduce:animate-none` wyłącza animację przy
`reduce`; opacity pozostaje stała. Bez JS, bez opóźnienia po hydratacji.
Lokalne dekoracyjne SVG w `public/states` pochodzą bezpośrednio z Figmy.

Testy interakcji: `pnpm exec vitest run components/states/states.test.tsx`.
