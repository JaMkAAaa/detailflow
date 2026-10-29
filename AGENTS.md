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
- **Stripe Billing = abonament Detailflow** (Solo 79 / Studio 149 / Pro 279 zł netto, trial 14 dni bez karty). To nie jest płatność klienta studia za detailing.
- **KSeF = faktura klienta studia** (FA(3), TEST i PROD rozdzielone). To nie jest to samo co Stripe Invoice.
- Faktury wystawia się **po zakończeniu zlecenia**. FV/41 nie powstaje z `#DF-0248`.
- Portal klienta: 3 etapy, nie 4. Token hashowany, surowy tylko w URL.
- Kwoty: `Decimal`, PLN. Nigdy `float`.
- Moduły po pierwotnym v1 (#142–#151) są wybrane i wchodzą pojedynczo, po technicznych zależnościach. Zamknięcie jednego nie oznacza, że pozostałe są ukończone. Właściciel produktu autoryzował 29.10.2026 wykonanie wszystkich #142–#151 („zrób wszystkie poza v1”): jeden moduł = jedno issue = jeden PR, z testami, merge po zielonym CI. Etykieta „Poza v1”/`blocked` w starym issue nie blokuje zakresu, ale zależności techniczne (`Blocked by`) nadal sprawdzaj. Epik #115 zostaje otwarty.
- #146 jest etapem decyzji MF i dokumentacji: [ustalenia offline](docs/ksef-offline-decyzja-mf.md). Nie dodawaj w nim klienta ani UI offline; kod wymaga osobnego późniejszego zakresu/PR po komentarzu MF i zdjęciu `blocked`. Ukończenie #146 nie oznacza wdrożenia offline.
- Wdrożone moduły po v1: #142 katalog usług, #143 magazyn chemii, #144 statystyki studia, #145 portfolio realizacji. #146 jest ukończonym badaniem/dokumentacją (bez kodu offline). #147 scalono w PR #186 (6d15fbb5): Solo 790 / Studio 1490 / Pro 2790 PLN netto/rok, z góry, automatyczne odnowienie, zmiana okresu od razu z proration Stripe. Kwoty ustalił OpenBot po jawnej delegacji użytkownika „dobierz sam”; [źródło i kontrakt](docs/stripe-roczny-przygotowanie.md). #148: implementacja sandbox Connect Standard + direct charges, prowizja Detailflow 0%, [kontrakt](docs/platnosci-klientow.md); bez dowodu hosted smoke i bez live. #149–#151 jeszcze bez własnego wdrożenia; wchodzą po jednym.
- Magazyn chemii (#143): pełne sztuki/ml, jawne korekty z kontrolą wersji, bez automatycznego zużycia ze zleceń.
- Statystyki studia (#144): `/statistics`, tylko owner (`stats:read`), nie platformowy A-05. Definicje metryk są w `docs/dokumentacja-wdrozenia.md` §6.5 — przychód to `WorkOrder.totalGross` zleceń `completed` wg `completedAt` (nie faktury, nie Stripe), brak źródłowych zdarzeń = „Brak danych”, nie 0. Zapytania przez `studioDb(studioId)`.
- Portfolio (#145): `/portfolio` dla zespołu, publikacja tylko owner/manager (`portfolio:manage`). Domyślnie nic nie jest publiczne. Widok `/realizacje/[slug]` nie zawiera danych klienta. Tablica na zdjęciu jest maskowana na osobnej pochodnej JPEG, chyba że studio świadomie ją zostawi. Oryginał S3 i jego krótki podpis nie wchodzą do widoku publicznego. Brak publikacji = pusty stan, nie 404. Odpublikowanie kasuje pochodną i działa też przy wstrzymanym abonamencie.
- Menu: „Usługi i cennik” prowadzi do katalogu studia. „Magazyn” prowadzi do `/inventory`. „Statystyki” prowadzą do `/statistics` (widoczne tylko dla ownera). „Portfolio” prowadzi do `/portfolio`, nie „Wkrótce” i nie 404.
- Seed ma odtwarzać dane makiety (Obsidian Studio, `#DF-0248`, etapy, kwoty), żeby dało się porównać UI.

## Stack

Next.js 15 App Router · PostgreSQL 16 · Prisma (migracje, nie `db push` na prod) · Docker Compose · Stripe Billing · Tailwind + tokeny `--df-*` · Auth.js lub Better Auth · BullMQ · S3/MinIO.

Nie dodawaj Clerk, GraphQL, Nest, Kafka „przy okazji”.

## PR

- Tytuł: `feat(zlecenia): …` / `ui(pulpit): …` / `fix(ksef): …`
- W opisie: `Closes #n` tylko po spełnieniu pełnych kryteriów tego issue (inaczej `Refs #n`), link do Figmy, checklista z issue.
- Test izolacji tenantów, jeśli ruszasz zapytania.
- `prefers-reduced-motion` przy animacjach.
