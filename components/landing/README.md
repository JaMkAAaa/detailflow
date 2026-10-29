# Landing L-01 / L-02 / L-03 — #49

Referencja: [06 Landing](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S?node-id=93-2737)
(L-01 desktop 1440, L-02 mobile 390, L-03 menu mobilne). Jeden układ responsywny
obsługuje L-01 i L-02; L-03 to pełnoekranowe menu w `SiteNav`.

## Routing

`/` jest pulpitem studia dla zalogowanych. Gość (brak cookie sesji) dostaje w `middleware.ts`
rewrite `/` → `/landing` (`app/(marketing)/landing/page.tsx`), więc URL zostaje `/`.
Cennik: `/#pricing`. Wszystkie CTA → `/start`.

## Reguły treści (docs §4.1, file-structure „Marketing”)

- Brak logotypów klientów, gwiazdek i opinii. Zamiast nich „SCENARIUSZ DEMO”.
- Cennik tylko miesięczny netto 79 / 149 / 279 zł, bez przełącznika roku.
- Przypomnienia o powłokach są oznaczone „Wkrótce”. Statystyki studia (#144) i galeria realizacji (#145) są w aplikacji.
  Landing nie obiecuje publikacji na Instagramie i nie zmyśla liczb z makiety.
- Kalkulator to **estymacja**: założenia są w `lib/landing/savings.ts`, pokazane w UI,
  liczone na `Decimal`. Do akceptacji prawnej przed publikacją.
- „Zobacz demo (2 min)” to placeholder — przewija do podglądu pulpitu, dopóki nie ma wideo.
- Podgląd pulpitu (`DashboardPreview`) to statyczna kopia D-01 na danych z
  `components/pulpit/demo.ts` (Obsidian Studio). Zmiany D-01 trzeba przenieść ręcznie.
- Stopka nie linkuje do nieistniejących stron (regulamin, RODO, blog…) ani do kont social.
