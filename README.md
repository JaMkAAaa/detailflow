# Detailflow

SaaS operacyjny dla studiów detailingowych: boksy, zlecenia, wyceny, faktury KSeF i portal klienta. Abonament platformy przez Stripe.

**Repo:** https://github.com/mikolajjedrzejczak/detailflow  
**Figma:** https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S  
**Dokumentacja wdrożenia:** [docs/dokumentacja-wdrozenia.md](docs/dokumentacja-wdrozenia.md)  
**Dla agentów AI:** [AGENTS.md](AGENTS.md)

Stack v1: **Next.js 15 · PostgreSQL · Prisma · Docker · Stripe**. Kod aplikacji dopiero powstaje — ten commit to specyfikacja, design tokens (logo) i backlog w Issues.

## Jak czytamy backlog

| Etykieta | Znaczenie |
| --- | --- |
| `type:epic` | Cały moduł. Nie implementować w jednym PR. |
| `type:ui` | Ekran / komponent 1:1 z Figmy. |
| `type:implement` | Model, API, worker, Stripe, KSeF. |
| `type:infra` | Compose, CI, obserwowalność. |
| `layer:ui` / `layer:api` / `layer:data` / `layer:worker` | Warstwa zmiany. |
| `area:*` | Moduł produktu (`pulpit`, `ksef`, `billing`, …). |
| `phase:0` … `phase:5` | Kolejność z dokumentacji. |
| `agent-ready` | Issue ma Figma, pliki docelowe i kryteria — można brać. |

Kamienie milowe = fazy v1 (fundament → operacje → pieniądz studia → SaaS → panel platformy → twardnienie).

## Dwa obiegi pieniędzy

1. Studio → Detailflow: **Stripe Billing** (79 / 149 / 279 zł netto).
2. Klient studia → studio: **faktura KSeF FA(3)**. Nie używamy Stripe do tej faktury w v1.

## Uruchomienie lokalne

```bash
cp .env.example .env
docker compose up
```

- Aplikacja: http://localhost:3000 (health: `/api/health`)
- Mailpit: http://localhost:8025 · MinIO: http://localhost:9001
- Zajęty port? Ustaw `WEB_PORT` / `POSTGRES_PORT` w `.env`.

Bez Dockera: `corepack enable && pnpm install && pnpm dev` (w `.env` hosty serwisów zamień na `localhost`).

## Baza danych

Schemat: `prisma/schema.prisma` (§9 dokumentacji). Zmiany wyłącznie migracjami — `db push` nie jest procesem produkcyjnym.

```bash
docker compose exec web pnpm db:migrate   # nowa migracja (dev)
docker compose exec web pnpm db:seed      # Obsidian Studio z makiety, czysty reset
```

Z hosta ustaw `DATABASE_URL=postgresql://detailflow:detailflow@localhost:5432/detailflow` (port z `POSTGRES_PORT`). Prisma 7 nie czyta `.env` sama.

- Produkcja: `prisma migrate deploy` z obrazu `--target migrate` przed startem web.
- Zapytania studia tylko przez `studioDb(studioId)` z `lib/db/tenant.ts`. `platformDb` (bez filtra) — panel platformy, auth, webhooki, seed.
- Testy: `pnpm test` (Vitest, wymaga `DATABASE_URL`; resetuje studio demo).
