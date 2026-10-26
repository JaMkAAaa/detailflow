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
