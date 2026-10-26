# Detailflow — instrukcja dla agentów AI i zespołu

Czytaj to przed pierwszym commitem. Źródła prawdy:

1. UI — [Figma](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S)
2. Produkt i stack — [`docs/dokumentacja-wdrozenia.md`](docs/dokumentacja-wdrozenia.md)
3. Mapa ekranów — [`file-structure.md`](file-structure.md)
4. Metryki panelu właściciela — [`audit/admin/README.md`](audit/admin/README.md)

## Jak brać pracę

- Bierz **jedno issue**, nie cały epik.
- Issue `type:epic` jest spisem. Nie otwieraj PR-a „zamyka epik” bez issue składowych.
- `type:ui` = ekran 1:1 z Figmy, dane mogą być seed/mock.
- `type:implement` = model, API, worker, integracja. Podłącz istniejący UI, nie przerabiaj makiety przy okazji.
- `agent-ready` = kontekst wystarcza do startu bez dopytywania.
- Nie ruszaj issue z innej fazy, jeśli zależności (`Blocked by`) nie są zamknięte.

## Twarde reguły produktu

- Multi-tenant: każde zapytanie operacyjne ma `studioId`. Helper `studioDb(studioId)`, nie „pamiętaj where”.
- **Stripe = abonament Detailflow** (Solo 79 / Studio 149 / Pro 279 zł netto, trial 14 dni bez karty).
- **KSeF = faktura klienta studia** (FA(3), TEST i PROD rozdzielone). To nie jest to samo co Stripe Invoice.
- Faktury wystawia się **po zakończeniu zlecenia**. FV/41 nie powstaje z `#DF-0248`.
- Portal klienta: 3 etapy, nie 4. Token hashowany, surowy tylko w URL.
- Kwoty: `Decimal`, PLN. Nigdy `float`.
- Poza v1: magazyn, statystyki, portfolio, pełny cennik CMS, KSeF offline, abonament roczny, płatność online klienta za detailing.
- Menu „Usługi i cennik / Magazyn / Statystyki / Portfolio” = „Wkrótce”, nie 404 i nie pusty CRUD.
- Seed ma odtwarzać dane makiety (Obsidian Studio, `#DF-0248`, etapy, kwoty), żeby dało się porównać UI.

## Stack

Next.js 15 App Router · PostgreSQL 16 · Prisma (migracje, nie `db push` na prod) · Docker Compose · Stripe Billing · Tailwind + tokeny `--df-*` · Auth.js lub Better Auth · BullMQ · S3/MinIO.

Nie dodawaj Clerk, GraphQL, Nest, Kafka „przy okazji”.

## PR

- Tytuł: `feat(zlecenia): …` / `ui(pulpit): …` / `fix(ksef): …`
- W opisie: `Closes #n`, link do Figmy, checklista z issue.
- Test izolacji tenantów, jeśli ruszasz zapytania.
- `prefers-reduced-motion` przy animacjach.
