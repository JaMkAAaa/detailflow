# Primitives — #20

Komponenty według wzorca shadcn (natywne elementy, CVA, `cn`, propsy i refy React 19).
Button i Input zachowują semantykę HTML; nie wymagają dodatkowego wrappera Radix.
Kolory pochodzą wyłącznie z tokenów `--df-*`. Konfiguracja generatora: `components.json`.

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

<Button type="submit" loading={pending}>Zapisz</Button>
<Button variant="secondary" disabled>Anuluj</Button>
<Badge variant="ready-for-pickup" />
<label htmlFor="email">E-mail</label>
<Input id="email" name="email" type="email" autoComplete="email" />
```

Button: `primary` / `secondary`, każdy z natywnym default / hover / focus-visible /
disabled / loading. Domyślnie `type="button"`; formularze wymagają `type="submit"`.
Utrzymuj `loading={true}` przez cały czas operacji. Ustawia `disabled`, `aria-busy`
i etykietę „◌ Ładowanie…” (`loadingLabel` pozwala ją zmienić), blokując kliknięcia
i ponowny submit. Loading zachowuje pełną opacity; disabled ma 40%.
Brak animacji, więc również przy reduced motion wskaźnik pozostaje statyczny.
Szerokość jest zależna od treści; wzorcowe 176 px można ustawić przez `className="w-44"`.

Badge — 9 wariantów z [Figmy](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=92-3540):
`in-progress`, `scheduled`, `ready-for-pickup`, `accepted-test`, `rejected`,
`draft`, `processing`, `retrying` (↻ Ponawiamy), `retry` (Ponawiamy).
Treść issue dodatkowo wymaga `completed`, `test`, `overdue`, `error` — korzystają
z semantyki kolorów §4.7 dokumentacji. Domyślne polskie etykiety można zastąpić
przez `children`. Badge jest nieinteraktywnym `span`, bez tab stopu i live region.
Dekoracyjne kropki to lokalne SVG z Figmy (`public/ui/status-*.svg`, 6 × 6 px).

Input: natywne propsy i ref, `disabled`, `readOnly`, placeholder, `aria-invalid`
(czerwona ramka). Rodzic zapewnia label i opis błędu przez `aria-describedby`.
Geometria pola pochodzi z [pola NIP](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=107-3045),
kolory używają tokenów projektu.

Focus klawiatury dla Button/Input i pozostałych kontrolek zapewnia globalne
`:focus-visible`: limonka, 2 px, odstęp 2 px. Nie usuwaj outline klasami konsumenta.

Walidacja zachowania formularza: `pnpm exec vitest run components/ui/primitives.test.tsx`.
