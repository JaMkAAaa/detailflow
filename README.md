# Detailflow — dokumentacja projektu

> **Detailflow** to polski SaaS operacyjny dla studiów detailingowych: kalendarz boksów, zlecenia, klienci i auta, wyceny, faktury KSeF oraz portal klienta. Studio płaci za platformę abonamentem Stripe, a swoje usługi rozlicza fakturą KSeF. To dwa osobne obiegi pieniędzy.

- **Repozytorium:** [JaMkAAaa/detailflow](https://github.com/JaMkAAaa/detailflow)
- **Figma (źródło UI):** [Detailflow](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S)
- **Zakres kodu:** commit `5a9780a3` (dokumentacja opisuje ten stan; późniejsze commity mogą go zmienić)
- **Stack:** Next.js 15 · React 19 · TypeScript · PostgreSQL 16 · Prisma 7 · Tailwind CSS 4 · Better Auth · BullMQ · Stripe · S3/MinIO · KSeF 2.0 TEST

Ten plik jest **główną dokumentacją techniczną i produktową** repozytorium. Opisuje nie tylko architekturę, ale też zakres wdrożonego produktu, reguły biznesowe, dane demonstracyjne, ograniczenia i sposób pracy z kodem. Szczegółowe dokumenty modułów są linkowane w sekcji [Dokumentacja źródłowa](#16-dokumentacja-źródlowa).

> **Ważne:** repozytorium zawiera działający szkielet v1, a nie tylko makietę. Część ekranów jest jednak nadal wersją demonstracyjną (największe luki: tworzenie zleceń, kreator faktury, wysyłka do KSeF z UI i panel administratora platformy). Dokładny stan opisuje [macierz wdrożenia](#3-status-wdrożenia).

---

## Spis treści

1. [Czym jest Detailflow](#1-czym-jest-detailflow)
2. [Szybki start](#2-szybki-start)
3. [Status wdrożenia](#3-status-wdrożenia)
4. [Architektura](#4-architektura)
5. [Struktura repozytorium](#5-struktura-repozytorium)
6. [Konfiguracja środowiska](#6-konfiguracja-środowiska)
7. [Baza danych i migracje](#7-baza-danych-i-migracje)
8. [Model danych](#8-model-danych)
9. [Moduły](#9-moduły)
10. [API](#10-api)
11. [Reguły biznesowe](#11-reguły-biznesowe)
12. [Bezpieczeństwo i RODO](#12-bezpieczeństwo-i-rodo)
13. [Testowanie i jakość](#13-testowanie-i-jakość)
14. [Wdrożenie i utrzymanie](#14-wdrożenie-i-utrzymanie)
15. [Luki i plan](#15-luki-i-plan)
16. [Dokumentacja źródłowa](#16-dokumentacja-źródlowa)
17. [Praca z repozytorium](#17-praca-z-repozytorium)
18. [Słownik](#18-słownik)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Czym jest Detailflow

### 1.1 Problem

Studio detailingowe prowadzi kilka równoległych obiegów informacji: grafik boksów, status auta, zdjęcia stanu, wycenę, dane klienta, fakturę i kontakt z klientem. W praktyce część z tego żyje w Excelu, część w WhatsAppie, część w notesie, a zdjęcia w losowych folderach. Skutki:

- kolizje rezerwacji i brak jednego planu dnia,
- klient dzwoni po status auta, bo nie ma gdzie go sprawdzić,
- wyceny są liczone od zera i różnią się między pracownikami,
- brak dowodów stanu auta przy reklamacjach,
- faktury są przepisywane ręcznie, a KSeF wymaga poprawnego XML FA(3),
- właściciel nie widzi obłożenia, zaległości ani powracających klientów.

### 1.2 Zadanie produktu

Domknąć dzień studia **od przyjęcia auta do faktury KSeF i odbioru przez klienta**:

1. zaplanować boks i zlecenie,
2. przyjąć auto z protokołem i zdjęciami,
3. prowadzić etapy pracy,
4. wycenić usługę i wysłać wycenę klientowi,
5. pozwolić klientowi zaakceptować wycenę bez zakładania konta,
6. wystawić fakturę po zakończeniu zlecenia,
7. wysłać fakturę do KSeF i pobrać UPO,
8. rozliczyć abonament platformy przez Stripe.

### 1.3 Cztery powierzchnie produktu

| Powierzchnia | Użytkownik | Cel | Gdzie w kodzie |
| --- | --- | --- | --- |
| Landing `detailflow.pl` | prospect | sprzedaż, trial, demo | `app/(marketing)/landing`, `components/landing` |
| Panel studia | właściciel, manager, pracownik | operacje dnia | `app/(studio)`, `components/*` |
| Portal klienta | klient studia, bez konta | status, wycena, decyzja | `app/p/[token]`, `components/portal` |
| Panel platformy (A-01–A-10) | operatorzy Detailflow | SaaS, MRR, wsparcie, audyt | **brak implementacji** — tylko Figma i `audit/admin/README.md` |

### 1.4 Role w studiu

| Rola | Dostęp |
| --- | --- |
| `owner` | wszystko, w tym billing, KSeF, faktury, zaproszenia |
| `manager` | operacje, klienci, wyceny, faktury, zaproszenia; bez billingu |
| `worker` | operacje, kalendarz, zlecenia, zdjęcia, klienci; bez faktur i zaproszeń |

Role są sprawdzane **przy każdym żądaniu** na podstawie `Membership`, a nie tylko w UI. Szczegóły: [`src/server/acl.ts`](src/server/acl.ts).

### 1.5 Dwa obiegi pieniędzy

| Obieg | Kto płaci | Mechanizm | Dokument |
| --- | --- | --- | --- |
| Abonament Detailflow | studio → Detailflow | Stripe Billing, PLN, miesięcznie | faktura abonamentowa Detailflow (poza aplikacją) |
| Usługa detailingu | klient studia → studio | przelew/gotówka; płatność online poza v1 | faktura KSeF FA(3) wystawiana przez studio |

**Nie mieszamy tych obiegów.** Model `Invoice` w bazie to faktura klienta studia (KSeF), a nie faktura Stripe. Stripe nie jest źródłem prawdy o fakturach detailingu, a KSeF nie rozlicza abonamentu platformy.

### 1.6 Plany i trial

| Plan | Cena netto / mies. | Stripe `lookup_key` |
| --- | --- | --- |
| Solo | 79 zł | `plan_solo_monthly` |
| Studio | 149 zł | `plan_studio_monthly` |
| Pro | 279 zł | `plan_pro_monthly` |

- Trial: **14 dni, bez karty**.
- Po trialu: Checkout Stripe albo dostęp tylko do odczytu (dane pozostają).
- Abonament roczny, płatność klienta online i limity planów **nie są wdrożone**.
- Cennik i obietnice z landingu wymagają zatwierdzenia prawnego przed publikacją.

### 1.7 Poza zakresem v1

- magazyn i stany chemii,
- statystyki zaawansowane,
- portfolio,
- pełny CMS „Usługi i cennik”,
- pełne Ustawienia i Konto,
- KSeF offline,
- panel właściciela platformy na mobile,
- płatność klienta online za detailing,
- abonament roczny,
- tryb jasny.

Pozycje te mogą być widoczne w menu jako **„Wkrótce”**, nigdy jako pusty CRUD albo 404.

---

## 2. Szybki start

### 2.1 Wymagania

- Docker Desktop lub Docker Engine + Compose,
- Node.js **>= 22** (obrazy produkcyjne używają Node 24),
- pnpm **10.34.9** (zarządzany przez Corepack),
- opcjonalnie: `xmllint` do walidacji XSD FA(3), Stripe CLI do webhooków, klient SMTP inny niż Mailpit.

### 2.2 Wariant Docker (zalecany)

```bash
cp .env.example .env
docker compose up --build -d

# pierwsze uruchomienie: zastosuj migracje i wgraj dane demo
docker compose exec web pnpm db:deploy
docker compose exec web pnpm db:seed

# podgląd logów
docker compose logs -f web worker
```

Adresy lokalne:

| Usługa | Adres |
| --- | --- |
| Aplikacja | http://localhost:3000 |
| Health check | http://localhost:3000/api/health |
| Mailpit (podgląd maili) | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | `localhost:5432` (lub `POSTGRES_PORT`) |
| SMTP Mailpit | `localhost:1025` |

Dane demo:

```text
E-mail:  michal.kowalski@example.com
Hasło:   obsidian-demo-2026
```

- Portal klienta (ważny link demo): http://localhost:3000/p/obsidian-df-0248-demo
- Portal klienta (wygasły link demo): http://localhost:3000/p/obsidian-df-0244-expired

Zajęty port? Ustaw `WEB_PORT` / `POSTGRES_PORT` w `.env`. Docker Compose nie wystawia Redisa na hosta.

### 2.3 Wariant lokalny (bez Dockera)

```bash
corepack enable
pnpm install

# w .env zamień postgres/redis/minio/mailpit na localhost
# DATABASE_URL=postgresql://detailflow:detailflow@localhost:5432/detailflow

pnpm db:deploy
pnpm db:seed
pnpm dev
# w drugim terminalu:
pnpm worker
```

`pnpm dev` wykonuje `prisma generate` i uruchamia Next.js z `--hostname 0.0.0.0`. `pnpm worker` uruchamia outbox mailowy, kolejkę KSeF i scheduler billingu. Do samego UI worker nie jest potrzebny, ale wysyłka maili i KSeF już go wymagają.

### 2.4 Najważniejsze komendy

| Komenda | Co robi |
| --- | --- |
| `pnpm dev` | Prisma generate + Next.js dev |
| `pnpm build` | Prisma generate + build Next.js + bundle workera (`dist/worker.mjs`) |
| `pnpm start` | start zbudowanego Next.js |
| `pnpm worker` | worker w trybie dev (`tsx watch`) |
| `pnpm worker:start` | worker z bundla produkcyjnego |
| `pnpm typecheck` | Prisma generate + `tsc --noEmit` |
| `pnpm lint` | ESLint (flat config) |
| `pnpm test` | Vitest, testy jednostkowe i integracyjne |
| `pnpm db:generate` | generuje klienta Prisma do `lib/db/generated` |
| `pnpm db:migrate` | `prisma migrate dev` — **tylko lokalnie, tworzy migrację** |
| `pnpm db:deploy` | `prisma migrate deploy` — stosuje istniejące migracje |
| `pnpm db:seed` | seed Obsidian Studio (kasuje i odtwarza studio demo) |
| `pnpm billing:setup` | tworzy produkty i ceny Stripe (osobno test/live) |

### 2.5 Baza testowa

Testy integracyjne używają prawdziwego PostgreSQL i **kasują/odtwarzają studio demo**. Nigdy nie uruchamiaj ich na bazie produkcyjnej.

```bash
# przykład: osobna baza lokalna po migracjach
DATABASE_URL=postgresql://detailflow:detailflow@localhost:5432/detailflow_test pnpm test
```

---

## 3. Status wdrożenia

Legenda: **Działa** = realne dane i zapis; **Częściowo** = część przepływu realna, część demo; **Demo** = wyłącznie UI na danych scenariusza; **Brak** = nie ma implementacji.

### 3.1 Ekrany i przepływy

| Obszar | Status | Co działa | Główne ograniczenie |
| --- | --- | --- | --- |
| Landing L-01/L-02/L-03 | **Działa** | responsywny landing, cennik, FAQ, kalkulator, CTA `/start` | treści marketingowe do zatwierdzenia; brak prawdziwych case studies |
| Logowanie | **Działa** | hasło (Argon2id) i magiczny link, reset hasła, wylogowanie | brak MFA; rate limit w pamięci procesu |
| Rejestracja trialu | **Działa** | `/start`, konto + studio + owner + 14 dni, bez karty | brak weryfikacji e-mail przed wejściem |
| Zaproszenia | **Działa** | `/team`, `/invite/[token]`, role manager/worker | brak listy członków i usuwania |
| Przełączanie studiów | **Działa** | cookie `df.active_studio`, picker w sidebarze | brak pickera na mobile |
| Pulpit D-01 / M-01 | **Działa** | KPI, plan boksów, lista dnia, alerty z DB | akcje „nowe zlecenie”, „zdjęcie”, „zakończ etap” nadal „Wkrótce” |
| Kalendarz D-02 / M-02 | **Działa** | rezerwacje boksów, dzień/tydzień, formularz, kolizje | brak przypisania pracownika w modelu; brak tworzenia zlecenia z kalendarza |
| Klienci D-05 | **Działa** | lista 20/stronę, filtry, karta, wyszukiwanie | brak zdjęcia auta w modelu |
| CRUD klientów/aut | **Działa** | dodawanie, edycja, usuwanie, import CSV | import tylko CSV, nie XLSX |
| Zlecenia D-03 / M-03 | **Demo** | tablica/lista na danych seeda, filtry, DnD wizualne | brak odczytu z DB; brak tworzenia zlecenia |
| Szczegóły zlecenia D-04 / M-04 | **Demo** | przegląd, zakładki, historia wizualna, wycena | brak zapisu etapu, zdjęć, linku do portalu |
| Backend zleceń | **Działa** | HTTP tworzenia i odczytu, maszyna stanów, historia, numeracja, `canInvoice` | UI nadal demo |
| Wyceny D-06 / M-05 | **Działa** | kreator, katalog, zapis szkicu, wysyłka maila, link portalu | terminy w kreatorze są demonstracyjne, nie rezerwują boksu |
| Portal P-01/P-02 | **Częściowo** | tokeny, decyzja o wycenie, P-02, mail do właścicieli | P-01 to statyczna makieta dla seeda; brak statusu zlecenia i zdjęć dla dowolnego linku |
| Faktury D-07/D-10 | **Działa** | lista, filtry, wyszukiwanie, uwaga, płatność, korekta | lista pobiera wszystkie faktury i paginuje po 7 w UI |
| Kreator faktury D-08 | **Demo** | kroki, walidacja, podgląd, autosave | **nie wywołuje POST** i nie wystawia dokumentu |
| Szczegóły faktury D-09/M-08 | **Częściowo** | dane, PDF, XML, płatność, korekta, UPO z DB | „wyślij ponownie” jest demo; brak wysyłki maila i KSeF z UI |
| KSeF TEST | **Częściowo** | klient API, szyfrowanie tokenu, worker, retry, historia | **brak endpointu/akcji enqueue**; seed tylko udaje dokumenty |
| Stripe Billing | **Działa** | plany, Checkout, webhooki, portal, trial, read-only, MRR | wymaga konfiguracji; brak panelu admina |
| Zdjęcia i protokół | **Częściowo** | presigned upload, S3, protokół, akceptacja | UI zlecenia nadal demo; brak sprzątania porzuconych plików |
| Panel platformy A-01–A-10 | **Brak** | tylko makieta i definicje metryk | osobny produkt/etap |
| Magazyn/statystyki/portfolio | **Brak** | menu „Wkrótce” | poza v1 |
| Wyszukiwarka ⌘K | **Brak** | placeholder w topbarze | poza zakresem tego etapu |
| E-mail transakcyjny | **Częściowo** | auth, zaproszenia, wycena, decyzja, trial | brak maila z fakturą; brak SMS |
| Obserwowalność | **Częściowo** | `/api/health` (DB i Redis), logi pino JSON, Sentry web + worker | brak metryk i gotowych alertów; Sentry milczy bez `SENTRY_DSN` |

### 3.2 Co to oznacza przy testach ręcznych

- **Dane demo są prawdziwe w bazie** dla pulpitu, kalendarza, klientów, wycen, faktur i portalu.
- **Nie oczekuj** zapisu zmiany etapu z ekranu zlecenia — UI pokazuje „Wkrótce”.
- **Nie oczekuj** wystawienia faktury przez kreator — użyj API `POST /api/studios/:studioId/invoices`.
- **Nie oczekuj** wysłania faktury do KSeF — token można zapisać API, ale nie ma jeszcze akcji enqueue z aplikacji.
- **Nie oczekuj** panelu admina — `/admin` nie istnieje.

---

## 4. Architektura

### 4.1 Widok ogólny

```text
przeglądarka (studio / mobile / portal klienta)
        │
        ▼
Next.js 15 — App Router
  RSC · Server Actions · Route Handlers
  middleware: cookie sesji + rewrite "/" na landing
        │
        ├──▶ PostgreSQL 16 (Prisma 7 + adapter pg) ◀── worker
        ├──▶ Redis / BullMQ (web enqueue, worker consume)
        ├──▶ S3 / MinIO (zdjęcia, PDF, UPO)
        ├──▶ SMTP / Mailpit (auth, outbox) ◀── worker
        ├──▶ Stripe API + webhook
        └──▶ KSeF API TEST ◀── worker
```

### 4.2 Monolit modularny

To **jeden deploy Next.js** plus **jeden worker** z tego samego obrazu. Nie ma osobnego API, GraphQL, Nesta ani Kafki. Granice modułów są w katalogach:

- `app/` — routing, strony, route handlery, server actions,
- `components/` — UI i logika prezentacji,
- `src/server/` — logika domenowa i operacje na bazie,
- `src/domain/` — czyste funkcje domenowe (cena, katalog),
- `src/ksef/` — adapter KSeF, XML FA(3), kolejka,
- `src/invoices/` — PDF i walidacja dokumentu,
- `lib/` — auth, db, env, storage, tokeny portalu,
- `worker/` — punkt wejścia procesu tła.

### 4.3 Cykl żądania

1. **Middleware** sprawdza tylko obecność cookie sesji (szybki filtr na edge). Dla `/p/*` ustawia nagłówki bezpieczeństwa. Dla gościa na `/` robi rewrite na `/landing`, zachowując URL `/`.
2. **Layout studia** (`app/(studio)/layout.tsx`) wywołuje `requireStudio()`, które:
   - weryfikuje sesję w bazie,
   - pobiera membershipy,
   - wybiera studio z cookie `df.active_studio` (albo pierwsze),
   - sprawdza rolę i status billingu,
   - zwraca `studioDb(studioId)`.
3. **Strona** czyta dane przez `studioDb`; **API** robi to samo przez `apiStudio()` i dodatkowo sprawdza `Origin` przy zapisie.
4. **Mutacje** używają transakcji (często Serializable), a konsekwencje (event, outbox, licznik) zapisują w tej samej transakcji.
5. **Worker** okresowo odbiera outbox i zadania z Redis; nie jest potrzebny do samego renderowania.

### 4.4 Multi-tenancy

Izolacja tenantów jest dwuwarstwowa:

1. **Warstwa aplikacji:** helper `studioDb(studioId)` opakowuje Prisma i wymusza `studioId` w `where`/`data`. Blokuje modele platformy, surowy SQL i przenoszenie rekordu do innego studia. Nowy model operacyjny trzeba dodać do `TENANT_MODELS`; inaczej helper go odrzuci.
2. **Warstwa bazy:** operacyjne tabele mają `studioId`, a relacje używają złożonych kluczy obcych `(id, studioId)`. Baza sama nie pozwoli powiązać zlecenia z klientem innego studia.

`platformDb` (bez filtra) wolno używać wyłącznie na granicach: auth, webhooki Stripe, seed, odkrywanie tenantów, panel platformy. Każde inne użycie w kodzie studia jest błędem. Portal i worker mają kilka świadomych wyjątków (odkrycie studia po hashu tokenu, lista tenantów do outboxa), opisanych w kodzie.

### 4.5 Uwierzytelnianie i sesje

- **Better Auth** z adapterem Prisma i sesjami w PostgreSQL.
- Logowanie: e-mail + hasło (Argon2id) **albo** magiczny link.
- Publiczna rejestracja w Better Auth jest wyłączona; konta tworzy trial (`/start`) i zaproszenia.
- Sesja: 14 dni, odświeżanie co 24 h, cookie httpOnly z prefiksem `df`.
- Reset hasła: token 60 min, unieważnia sesje.
- Magic link: 15 min, token hashowany, tylko istniejące konta, odpowiedź zawsze taka sama.
- Rate limit: 100 żądań/min, logowanie 5/min, reset 3–5/min; **w pamięci procesu**, więc przy wielu instancjach trzeba przejść na Redis.

### 4.6 Tło i kolejki

| Mechanizm | Nośnik | Uruchamiane przez | Przeznaczenie |
| --- | --- | --- | --- |
| Outbox maili | PostgreSQL | `setInterval` 15 s w workerze | wyceny, decyzje portalu |
| `ksef-test` | BullMQ + Redis | worker | wysyłka i poll KSeF TEST |
| `billing-daily` | BullMQ + Redis | worker | codzienny sweep trialu o 06:00 Europe/Warsaw + catch-up |

Outbox w PostgreSQL jest używany celowo zamiast drugiej kolejki Redis dla maili: zapis jest trwały nawet przy wyłączonym workerze i braku SMTP, a ponowienia nie tworzą nowej wiadomości w bazie.

### 4.7 Granice odpowiedzialności

- **Stripe** jest źródłem prawdy o subskrypcji; Postgres trzyma kopię `status`/`plan` do autoryzacji.
- **KSeF** jest źródłem prawdy o numerze KSeF i UPO; Postgres trzyma snapshot XML, referencje i historię.
- **S3** trzyma pliki; Postgres trzyma metadane i klucze, nigdy publiczne URL-e.
- **SMTP** dostarcza maile; outbox w Postgresie jest trwałym zleceniem wysyłki.

---

## 5. Struktura repozytorium

```text
app/
  (auth)/                 logowanie, trial, reset, zaproszenia, logout
  (marketing)/landing/    landing publiczny
  (studio)/               panel studia (sidebar/topbar/tabbar)
  p/[token]/              portal klienta bez sesji
  api/                    route handlery (auth, health, Stripe, studio API)
components/
  auth/ brand/ faktury/ kalendarz/ klienci/ landing/ portal/
  pulpit/ states/ studio/ ui/ wyceny/ zlecenia/
lib/
  auth.ts, auth/, db/, portal/, landing/, env.ts, storage.ts, utils.ts
src/
  domain/                 czysta domena (cena, katalog, terminy)
  invoices/               PDF i walidacja dokumentu
  ksef/                   klient KSeF, FA(3), szyfrowanie, kolejka
  server/                 ACL, HTTP, moduły operacyjne, billing
  worker/                 workery BullMQ
worker/index.ts           punkt wejścia procesu tła
prisma/
  schema.prisma           model danych
  migrations/             12 migracji
  seed.ts                 Obsidian Studio
audit/admin/              definicje panelu platformy (makieta, nie kod)
docs/                     dokumentacja wdrożenia i naprawa migracji
branding/                 logo Flowcut (SVG)
public/                   assety UI, ikony, zdjęcia demo
```

### 5.1 Najważniejsze pliki

| Plik | Rola |
| --- | --- |
| `prisma/schema.prisma` | źródło prawdy modelu danych |
| `lib/db/tenant.ts` | `studioDb`, wymuszanie izolacji |
| `lib/auth.ts` | konfiguracja Better Auth |
| `src/server/acl.ts` | role i uprawnienia |
| `src/server/http.ts` | sesja API, Origin, mapowanie błędów |
| `src/server/zlecenia/state.ts` | maszyna stanów zlecenia |
| `src/domain/pricing.ts` | silnik wyceny |
| `src/server/faktury/manage.ts` | wystawianie, korekta, płatność |
| `src/ksef/fa3.ts` | generator XML FA(3) |
| `src/invoices/pdf.ts` | PDF faktury |
| `src/server/billing/webhook.ts` | idempotentne webhooki Stripe |
| `worker/index.ts` | start workera i outboxa |

---

## 6. Konfiguracja środowiska

Wzór: [`.env.example`](.env.example). W Dockerze hosty to nazwy usług (`postgres`, `redis`, `minio`, `mailpit`); na hoście zamień je na `localhost`.

### 6.1 Zmienne wymagane

| Zmienna | Przykład | Znaczenie |
| --- | --- | --- |
| `APP_URL` | `http://localhost:3000` | publiczny origin; używany w mailach, CSRF, Stripe i portalu |
| `DATABASE_URL` | `postgresql://detailflow:detailflow@postgres:5432/detailflow` | PostgreSQL |
| `REDIS_URL` | `redis://redis:6379` | BullMQ |
| `S3_ENDPOINT` | `http://minio:9000` | wewnętrzny endpoint S3 |
| `S3_PUBLIC_ENDPOINT` | `http://localhost:9000` | endpoint widoczny z przeglądarki do podpisywania URL-i |
| `S3_REGION` | `us-east-1` | region S3 |
| `S3_BUCKET` | `detailflow` | prywatny bucket |
| `S3_ACCESS_KEY` | `detailflow` | klucz S3 |
| `S3_SECRET_KEY` | `detailflow-dev-secret` | sekret S3 |
| `AUTH_SECRET` | losowe 32+ znaki | sekret Better Auth |

### 6.2 Stripe (opcjonalne, ale potrzebne do billingu)

| Zmienna | Znaczenie |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` / `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` endpointu |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | opcjonalny; hostowany Checkout go nie wymaga |

Bez kluczy aplikacja działa, ale billing zwraca „Stripe nie jest skonfigurowany”. Po ustawieniu klucza uruchom `pnpm billing:setup` **osobno dla test i live**.

### 6.3 KSeF (TEST domyślnie, PROD za flagą)

| Zmienna | Znaczenie |
| --- | --- |
| `KSEF_ENV` | musi być `test`; inna wartość rzuca błąd. To nie jest przełącznik studia |
| `KSEF_API_URL` | `https://api-test.ksef.mf.gov.pl` (opcjonalnie `/v2`) |
| `KSEF_TOKEN_ENCRYPTION_KEY` | dokładnie 32 losowe bajty w base64, klucz tokenów TEST |
| `KSEF_PROD_API_URL` | opcjonalnie; dozwolony jest tylko `https://api.ksef.mf.gov.pl` |
| `KSEF_PROD_TOKEN_ENCRYPTION_KEY` | osobny klucz tokenów PROD, ten sam format co klucz TEST |

`KSEF_ENV=production` i obce hosty są **odrzucane także przy `SKIP_ENV_VALIDATION=1`**. PROD włącza flaga platformy `ksef_prod` oraz `Studio.ksefEnv`. Token TEST nie odszyfruje się jako PROD.

### 6.4 E-mail

| Zmienna | Znaczenie |
| --- | --- |
| `SMTP_URL` | np. `smtp://mailpit:1025` lub URL dostawcy |
| `EMAIL_FROM` | nadawca, np. `Detailflow <noreply@detailflow.local>` |
| `RESEND_API_KEY` | zarezerwowane; obecnie **nieużywane** |
| `SMSAPI_TOKEN` | zarezerwowane; SMS **nie są wysyłane** |

Bez `SMTP_URL` w trybie development maile auth trafiają do logu serwera; w produkcji wysyłka kończy się błędem, a outbox pozostaje oczekujący.

### 6.5 Pozostałe

| Zmienna | Znaczenie |
| --- | --- |
| `SENTRY_DSN` | Sentry dla serwera Next i workera. Puste = zdarzenia są odrzucane |
| `NEXT_PUBLIC_SENTRY_DSN` | opcjonalny DSN przeglądarki (zwykle ten sam projekt) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | opcjonalny upload source map przy buildzie. Bez kompletu upload jest wyłączony |
| `BACKUP_RETENTION_DAYS` | domyślnie 14. `pnpm backup` robi jeden `pg_dump --format=custom` do S3; `backup:cron` i serwis Compose `backup` powtarzają go o `BACKUP_HOUR_UTC` (domyślnie 3) |
| `BACKUP_S3_PREFIX` | domyślnie `backups/postgres` w `S3_BUCKET` |
| `SKIP_ENV_VALIDATION` | używane w buildzie Docker/CI; nie ustawiaj w runtime produkcyjnym |

### 6.6 Ważne zależności między zmiennymi

- `APP_URL` musi być **dokładnym originem**, z którego przeglądarka wysyła żądania. Wszystkie zapisy API porównują `Origin` z `new URL(APP_URL).origin`. Inny port/host = 403.
- `S3_PUBLIC_ENDPOINT` musi być osiągalny z przeglądarki, bo podpis obejmuje host. W Compose `S3_ENDPOINT` to `minio:9000`, więc lokalnie ustaw `S3_PUBLIC_ENDPOINT=http://localhost:9000`.
- `KSEF_TOKEN_ENCRYPTION_KEY` nie może leżeć w repo; zmiana klucza wymaga ponownego zapisania tokenów (brak automatycznej rotacji).
- `prisma.config.ts` wczytuje `.env` z katalogu repo, jeśli `DATABASE_URL` nie jest już w środowisku procesu. W kontenerze zmienne pochodzą z `env_file` w Compose.

---

## 7. Baza danych i migracje

### 7.1 Zasady

- PostgreSQL **16**.
- Zmiany schematu **wyłącznie migracjami**; `prisma db push` nie jest procesem produkcyjnym.
- Migracje leżą w `prisma/migrations/`; jest ich **12**.
- `prisma.config.ts` wskazuje seed `tsx prisma/seed.ts`.
- Wygenerowany klient Prisma (`lib/db/generated/`) jest w `.gitignore`; trzeba go wygenerować (`pnpm db:generate`, `pnpm dev`, `pnpm build`).

### 7.2 Komendy

```bash
# lokalny dev: nowa migracja po zmianie schema.prisma
pnpm db:migrate

# wdrożenie istniejących migracji (dev/prod/CI)
pnpm db:deploy

# reset danych demo (kasuje studio Obsidian i odtwarza)
pnpm db:seed

# weryfikacja, że schema i migracje są zgodne
pnpm prisma migrate diff \
  --from-config-datasource \
  --to-schema prisma/schema.prisma \
  --exit-code
```

### 7.3 Migracje w repozytorium

| Migracja | Zakres |
| --- | --- |
| `20261026162550_init` | fundament: Studio, klienci, auta, boksy, zlecenia, wyceny, faktury |
| `20261026211335_auth` | User, Session, Account, Verification |
| `20261026220000_invitations` | zaproszenia |
| `20261026230000_coating_reminders` | przypomnienia o powłoce |
| `20261026232824_order_photos_intake` | zdjęcia i protokół przyjęcia |
| `20261027090000_order_state` | historia zlecenia i licznik numerów |
| `20261027110000_portal_decisions` | decyzje portalu i outbox |
| `20261027120000_quote_send` | wysyłka wycen |
| `20261027160000_quote_delivery` | dostarczenie wyceny |
| `20261027210000_ksef_submissions` | snapshot XML i kolejka KSeF |
| `20261027220000_invoice_corrections` | korekty faktur |
| `20261027230000_trial_reminder` | przypomnienie o trialu |

### 7.4 Seed

`prisma/seed.ts` odtwarza **Obsidian Studio 1:1 z makiety**:

- studio `active`, plan `studio`, `ksefEnv=test`, Warszawa Mokotów,
- właściciel Michał Kowalski (`michal.kowalski@example.com` / `obsidian-demo-2026`),
- 124 klientów, 168 aut, 2 boksy,
- 7 aktywnych zleceń (3 w trakcie, 2 do odbioru, 2 przyjęte) + zlecenia zakończone,
- wycena Porsche #DF-0248: 4 000 zł × 1,20 × 1,00 = 4 800 zł, VAT 897,56 zł,
- 8 faktur TEST, w tym FV/41/10/2026 z **#DF-0243** (nie z #DF-0248),
- 3 przypomnienia o powłoce ceramicznej,
- 2 linki portalu: ważny i wygasły.

Seed jest **destrukcyjny tylko dla studia demo**: `studio.deleteMany({ slug: "obsidian-studio" })` kaskadowo usuwa jego dane, po czym tworzy je od nowa. Inne studia zostają. Użytkownik właściciela jest `upsert`owany.

Seed nie tworzy `KsefSubmission`, więc UPO dla FV/41 nie istnieje; numer KSeF i historia są danymi demonstracyjnymi. Seed **nie wysyła nic do MF**.

### 7.5 Naprawa historii migracji

Jeśli lokalna baza ma wpis `coating_reminders` pod starą nazwą i migracja się wysypuje, nie usuwaj tabel ręcznie. Procedura diagnostyki, backupu i `migrate resolve` jest w [`docs/naprawa-migracji-coating-reminders.md`](docs/naprawa-migracji-coating-reminders.md).

---

## 8. Model danych

### 8.1 Zasady ogólne

- Każdy model operacyjny ma `studioId`.
- Relacje między modelami operacyjnymi używają złożonych FK `(id, studioId)`, więc baza odrzuca mieszanie tenantów.
- Kwoty: `Decimal(12, 2)`, PLN. Ilości: `Decimal(10, 3)`. Nigdy `Float` dla pieniędzy.
- Daty w bazie: UTC. Prezentacja i logika dnia: `Europe/Warsaw`.
- Unikalność numerów dokumentów jest **per studio i środowisko KSeF**.

### 8.2 Modele platformy (bez `studioId`)

| Model | Najważniejsze pola | Rola |
| --- | --- | --- |
| `Studio` | `name`, `slug`, `status`, `plan`, `trialEndsAt`, `stripeCustomerId`, `stripeSubscriptionId`, `ksefEnv`, `ksefTokenEnc` | tenant i stan billingu |
| `User` | `email`, `name`, `emailVerified` | konto osoby |
| `Session` | `token`, `expiresAt`, `userId` | sesja Better Auth |
| `Account` | `providerId`, `accountId`, `password` | hasło Argon2id / provider |
| `Verification` | `identifier`, `value`, `expiresAt` | magic link / reset |
| `StripeEvent` | `id` (`evt_...`), `type`, `processedAt` | idempotencja webhooków |
| `AuditLog` | `actorId`, `studioId`, `action`, `meta` | audyt; obecnie zapisuje tylko billing |

### 8.3 Modele operacyjne

| Model | Najważniejsze pola | Rola |
| --- | --- | --- |
| `Membership` | `studioId`, `userId`, `role` | rola w studiu |
| `Invitation` | `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt` | zaproszenie jednorazowe |
| `Client` | `name`, `email`, `phone`, adres, `nip`, `isRegular` | klient studia |
| `Vehicle` | `clientId`, `make`, `model`, `plate`, `size` | auto klienta |
| `Bay` | `name`, `sort` | boks |
| `Service` | `code`, `name`, `basePrice`, `durationMin`, `sort` | katalog wyceny |
| `WorkOrder` | `number`, `clientId`, `vehicleId`, `bayId`, `quoteId`, `status`, `stage`, `scheduledFrom/To`, `dueAt`, `completedAt`, `totalGross` | zlecenie |
| `OrderCounter` | `studioId`, `last` | atomowa numeracja `DF-####` |
| `WorkOrderEvent` | `fromStatus`, `toStatus`, `fromStage`, `toStage`, `actorId` | historia zlecenia |
| `OrderPhoto` | `workOrderId`, `no`, `stage`, `key`, `contentType`, `sizeBytes`, `uploadedAt` | zdjęcie w S3 |
| `IntakeProtocol` | `workOrderId`, `number`, `acceptedAt` | protokół przyjęcia |
| `IntakeDamage` | `protocolId`, `no`, `title`, `part`, `posX`, `posY`, `photoId` | punkt uszkodzenia |
| `CoatingReminder` | `vehicleId`, `dueAt`, `completedAt` | jawny termin konserwacji |
| `Quote` | `clientId`, `vehicleId`, `status`, `sizeMult`, `paintMult`, `totalGross`, `vatAmount`, `sentAt`, `decidedAt`, `revision`, `wizardStep` | wycena |
| `QuoteItem` | `quoteId`, `name`, `basePrice`, `durationMin`, `sort` | snapshot pozycji |
| `QuoteSendMail` | `quoteId`, `sentAt` | trwały outbox wysyłki wyceny |
| `QuoteDecisionMail` | `quoteId`, `sentAt` | outbox powiadomienia o decyzji |
| `Invoice` | `number`, `workOrderId`, `status`, `kind`, `ksefEnv`, `ksefStatus`, `ksefNumber`, `buyer*`, `issuedAt`, `saleAt`, `dueAt`, `paidAt`, `emailedAt`, `totalNet/Vat/Gross`, `correctsInvoiceId` | faktura lub korekta |
| `InvoiceItem` | `invoiceId`, `lp`, `name`, `quantity`, `unit`, `unitNet`, `vatRate`, `net`, `vat`, `gross` | pozycja faktury |
| `InvoiceCounter` | `studioId`, `ksefEnv`, `kind`, `year`, `last` | numeracja `FV`/`KFV` |
| `KsefEvent` | `invoiceId`, `kind`, `at`, `attempt`, `ref`, `message` | historia KSeF |
| `KsefSubmission` | `invoiceId`, `xml`, `xmlHash`, `sessionReference`, `invoiceReference`, `sendStartedAt` | niezmienny snapshot wysyłki |
| `PortalLink` | `tokenHash`, `workOrderId?`, `quoteId?`, `expiresAt`, `revokedAt` | link klienta |

### 8.4 Enumy

| Enum | Wartości |
| --- | --- |
| `StudioStatus` | `trial`, `active`, `past_due`, `suspended`, `canceled` |
| `Plan` | `solo`, `studio`, `pro` |
| `MembershipRole` | `owner`, `manager`, `worker` |
| `VehicleSize` | `small`, `medium`, `suv` |
| `OrderStatus` | `accepted`, `in_progress`, `ready_for_pickup`, `completed`, `canceled` |
| `QuoteStatus` | `draft`, `sent`, `accepted`, `rejected`, `expired` |
| `InvoiceStatus` | `draft`, `issued`, `canceled` |
| `KsefStatus` | `not_sent`, `queued`, `processing`, `accepted`, `rejected`, `retrying` |
| `InvoiceKind` | `invoice`, `correction` |
| `KsefEnv` | `test`, `production` |
| `KsefEventKind` | `issued`, `validated`, `sent`, `timeout`, `processing`, `accepted`, `rejected`, `retry_scheduled` |

### 8.5 Niezmienniki

- Fakturę wystawia się **tylko** ze zlecenia `completed` z `completedAt`.
- Jedna aktywna faktura na zlecenie w danym środowisku; zmiany idą korektą.
- Korekta tylko do faktury `issued` i przyjętej w KSeF; nie ma korekty korekty.
- `paidAt` jest źródłem statusu „opłacona”; nie ma osobnej wartości enuma.
- `ksefStatus` jest niezależny od `status` i `paidAt`.
- Wysłanej wyceny nie można edytować.
- Zaakceptowany protokół jest niezmienny.
- Token portalu w bazie jest tylko hashem; surowy token żyje wyłącznie w URL.
- Webhook Stripe jest idempotentny po `event.id`.
- Numeracja `DF-####`, `FV/n/MM/RRRR`, `KFV/n/MM/RRRR` jest per studio; faktury dodatkowo per środowisko i rok.

---

## 9. Moduły

### 9.1 Logowanie, rejestracja i sesje

**Implementacja:** `lib/auth.ts`, `lib/auth/`, `app/(auth)/`, `app/api/auth/[...all]`.

- Hasła: Argon2id (19 MiB, t=2, p=1), format PHC; uszkodzony hash = złe hasło, nie 500.
- Magic link: 15 min, token hashowany, tylko istniejące konta, odpowiedź identyczna dla znanego i nieznanego e-maila.
- Reset hasła: 60 min, unieważnia sesje, wysyłka w tle (czas odpowiedzi nie zdradza istnienia konta).
- Sesja: 14 dni, cookie httpOnly, `SameSite=Lax`, `Secure` w produkcji, prefiks `df`.
- Middleware sprawdza tylko obecność cookie; **prawdziwa weryfikacja jest w layoutcie** (`requireSession`), bo wygasłe/odwołane cookie też przejdzie filtr edge.
- `safeNext()` blokuje open redirect (`//evil.pl`, `https://...`).
- Wylogowanie jest Server Action (POST), nie linkiem GET.

**Rejestracja trialu** (`src/server/studio/create.ts`):

- wejście: imię i nazwisko, nazwa studia, e-mail, hasło 10–128 znaków,
- w jednej transakcji: `Studio` (status `trial`, plan `solo`, `trialEndsAt=+14 dni`), `User`, `Account` (credential), `Membership` owner,
- brak tworzenia klienta Stripe i brak karty,
- unikalny e-mail rozstrzyga równoległe rejestracje,
- po sukcesie Server Action loguje użytkownika i przekierowuje na `/`.

**Zaproszenia** (`src/server/studio/invitations.ts`, `/team`, `/invite/[token]`):

- role tylko `manager` albo `worker`; nie można zaprosić ownera,
- token 256 bitów, SHA-256 w bazie, TTL 7 dni, jednorazowy,
- e-mail musi się zgadzać z zaproszeniem,
- istniejąca rola w studiu pozostaje bez zmian (upsert membership bez update),
- błąd wysyłki maila usuwa zaproszenie.

### 9.2 Role i dostęp

**Implementacja:** `src/server/acl.ts`, `src/server/http.ts`, `src/server/studio/context.ts`.

| Uprawnienie | Role |
| --- | --- |
| `billing:manage` | owner |
| `studio:select` | owner, manager, worker |
| `studio:read` | owner, manager, worker |
| `orders:write` | owner, manager, worker |
| `orders:update` | owner, manager, worker |
| `quotes:write` | owner, manager |
| `invoices:manage` | owner, manager |
| `members:invite` | owner, manager |

Zasady:

- brak sesji → **401**,
- brak membershipu, cudze studio, brak uprawnienia → **403**,
- obcy/nieistniejący rekord w dostępnym studiu → **404** (nie ujawniamy istnienia),
- `POST /api/studios/active` zapisuje wybór studia w cookie **po** autoryzacji; cookie nie jest źródłem uprawnień,
- status billingu `past_due`, `suspended`, `canceled` lub wygasły trial blokuje **wszystkie zapisy** (403) poza `billing:manage` i `studio:select`; odczyt działa,
- `requireStudio()` bez membershipu zwraca 404, nie 403.

### 9.3 Pulpit

**Implementacja:** `app/(studio)/page.tsx`, `src/server/pulpit/metrics.ts`, `components/pulpit/`.

Dane pochodzą z `studioDb`; **nie ma fallbacku na dane demo**, gdy baza jest pusta. Definicje KPI:

| KPI | Definicja |
| --- | --- |
| Przychód miesiąca | suma `WorkOrder.totalGross` dla `completed`, po `completedAt` w miesiącu Europe/Warsaw |
| Aktywne | `accepted` + `in_progress` + `ready_for_pickup` |
| Obłożenie | suma unii przedziałów aktywnych zleceń w boksach, przycięta do 08:00–16:00 / (liczba boksów × 8 h); nakładki nie liczą się podwójnie |
| Powracający | `isRegular=true` / wszyscy klienci |
| Alert ceramiki | unikalni klienci z `CoatingReminder` po terminie lub do końca dnia za 7 dni |
| Alert KSeF | faktury `rejected` w środowisku skonfigurowanym dla studia |

„Na warsztacie”: pierwsze `in_progress` w boksie, którego przedział przecina dzisiejszy dzień. Plan dnia pokazuje 08:00–16:00. Akcje „nowe zlecenie”, „zdjęcie”, „zakończ etap” i „link do portalu” są nadal dialogami „Wkrótce”, mimo że backend dla części z nich istnieje.

### 9.4 Kalendarz i rezerwacje

**Implementacja:** `app/(studio)/calendar/page.tsx`, `src/server/kalendarz/booking.ts`, `components/kalendarz/`.

- Rezerwacja to `bayId` + `scheduledFrom` + `scheduledTo` na istniejącym `WorkOrder`; **nie ma osobnej tabeli rezerwacji**.
- Daty lokalne (`2026-10-27T10:00`) oznaczają czas ścienny Warszawy; ISO z offsetem/Z oznacza konkretną chwilę. Baza trzyma UTC.
- Nieistniejąca godzina w zmianie czasu i niejednoznaczna godzina lokalna są odrzucane (400); w drugim przypadku trzeba podać offset.
- Przedziały są **półotwarte** `[od, do)`: 10–12 i 12–14 są dozwolone.
- Kolizja w tym samym boksie → 409; inny boks → OK. Anulowane zlecenia nie blokują.
- Zakończone zlecenia zachowują historię zajętości, ale nie można ich rezerwować ponownie ani przesuwać.
- Zapis i sprawdzenie kolizji są w jednej transakcji Serializable z ograniczonym ponowieniem (Prisma P2034 / `TransactionWriteConflict`).
- `POST` przypisuje boks do zlecenia bez rezerwacji; `PUT` zmienia; `DELETE` zwalnia boks, zachowując zlecenie i daty.
- UI: widok dnia i tygodnia, pasek tygodnia na mobile, wolne okna ≥ 60 min, formularz rezerwacji. Filtr pracownika pokazuje tylko „Wszystkie osoby”, bo model nie ma przypisania pracownika.

### 9.5 Klienci i auta

**Implementacja:** `app/(studio)/customers/`, `src/server/klienci/`, `components/klienci/`.

- Lista D-05: 20 wierszy na stronę **w SQL** (`take`/`skip`), nie w przeglądarce.
- Filtry: wszyscy / stali klienci / serwis powłoki; wyszukiwanie po nazwie, telefonie, rejestracji, marce i modelu.
- Telefon jest normalizowany do wariantów (`600123`, `+48600123456`, `600 123`); rejestracja do wariantów `WA 911PC` / `wa911`.
- Karta klienta: auta, ostatnie wizyty, aktywne zlecenie, suma brutto, informacja o powłoce.
- CRUD: klient, auto, zmiana właściciela auta w tym samym studiu.
- **Duplikat tablicy nie jest błędem**: zapis przechodzi, odpowiedź zawiera `warnings: [{ code: "duplicate_plate", ... }]`. Powód: historyczne dane z Excela i sprzedaż auta.
- Usunięcie klienta/auta z historią zleceń lub wycen → **409**.
- Import CSV: maks. 1 MB i 5000 wierszy; separator `,`/`;`/tab; BOM; aliasy nagłówków PL/EN; wymagane imię, marka, model, tablica; dopasowanie klienta po e-mailu, potem telefonie, tylko w tym studiu; ten sam klient + ta sama tablica = `unchanged`.
- Import przyjmuje **CSV**, nie XLSX. Landing mówi o Excelu — trzeba zapisać arkusz jako CSV albo dodać parser XLSX w przyszłości.
- Strona `/customers` używa `directory.ts` (sortowanie od najdłużej współpracujących, nacisk na demo D-05); API `GET /clients` używa `clients.ts` (sortowanie po nazwie, 20/stronę). To dwie świadome ścieżki odczytu.

### 9.6 Zlecenia i maszyna stanów

**Implementacja:** `src/server/zlecenia/state.ts`, `src/server/zlecenia/README.md`.

Logika i HTTP są gotowe i przetestowane. Route handlery wywołują `transitionOrder`/`advanceStage`; **ekrany D-03/D-04/M-03/M-04 są nadal demo** i wymagają osobnego podłączenia.

Maszyna stanów:

```text
accepted ──▶ in_progress ──▶ ready_for_pickup ──▶ completed
    │             │                  │
    └──▶ canceled └──▶ canceled      └──▶ in_progress (poprawka)
```

- `accepted → completed` i `accepted → ready_for_pickup` są zabronione.
- `completed` i `canceled` są końcowe.
- Etapy studia: 1 Przyjęcie i mycie, 2 Korekta, 3 Ceramika, 4 Kontrola i odbiór.
- `accepted` = etap 1; `in_progress` = 1–3; `ready_for_pickup`/`completed` = 4; `canceled` zachowuje etap.
- `advanceStage` („Zakończ: etap”) przesuwa o jeden; z etapu 3 daje `ready_for_pickup` i etap 4.
- Każda zmiana zapisuje `WorkOrderEvent` w tej samej transakcji; warunek `status`/`stage` w `where` odrzuca wyścig (409).
- `assertInvoiceable` wymaga `completed` + `completedAt`.
- Numer `DF-####`: `OrderCounter` per studio, atomowy increment; brak licznika startuje od najwyższego istniejącego numeru.

**HTTP** (`/api/studios/:studioId/orders`): `GET` zwraca listę, `POST` tworzy zlecenie (`clientId`, `vehicleId`, `service`, `totalGross` jako tekst dziesiętny, `scheduledFrom`, `scheduledTo`). Daty bez offsetu oznaczają Warszawę; luki i powtórzenia DST wymagają offsetu, jak w kalendarzu. Numer, status `accepted`, etap 1 i zdarzenie utworzenia zapisują się atomowo. Auto musi należeć do wskazanego klienta.

`GET /:id` przyjmuje id albo `DF-####`. `POST /:id/status` przyjmuje `{ "status": "in_progress" }`; `POST /:id/advance` przesuwa etap bez body. Zapis wymaga Origin, wszystkie endpointy wymagają sesji i roli owner/manager/worker (`orders:write` dla odczytu/tworzenia, `orders:update` dla statusu/etapu). Cudze studio/rekord → 404, blokada zapisu przez billing → 403, nielegalny ruch lub konflikt → 409. **Brakuje:** podłączenia UI.

### 9.7 Wyceny

**Implementacja:** `app/(studio)/quotes/new`, `src/server/wyceny/`, `src/domain/pricing.ts`, `components/wyceny/`.

- Kreator 3 kroków; krok 2 odpowiada D-06, kroki 1 i 3 są zbudowane w kodzie.
- Strona ładuje klientów z autami, katalog usług i najnowszy szkic autora; dostęp owner/manager.
- Cena: `suma baz × mnożnik rozmiaru × mnożnik lakieru`, brutto PLN.
- Rozmiary: `small` ×1,00, `medium` ×1,20, `suv` ×1,35.
- Lakier: ×1,00 / ×1,20 / ×1,40 (UI: standard / zużyty / mocno zużyty).
- VAT: `brutto × 23/123`, zaokrąglenie HALF_UP do grosza. Przykład: 4 000 × 1,20 × 1,00 = **4 800,00 zł**, VAT **897,56 zł**.
- Czas: suma minut × mnożnik rozmiaru, w górę do pełnej minuty; lakier nie zmienia czasu; brak czasu usługi = `null`.
- `PUT /api/studios/:studioId/quotes/:quoteId` przyjmuje UUID tworzony przez klienta przed pierwszym zapisem, więc retry nie tworzy drugiej wyceny.
- Zapis zastępuje pozycje w transakcji Serializable; równoległy zapis → 409.
- Wysłanej/rozstrzygniętej wyceny nie można edytować.
- `POST .../send` ustawia `sent` i tworzy `QuoteSendMail`; wymaga e-maila klienta i pozycji.
- Worker co 15 s wysyła mail z linkiem portalu; token powstaje w workerze, w bazie tylko SHA-256 i TTL 14 dni. Link z ponownej wysyłki nie unieważnia poprzednich.
- `Quote.sentAt` = ostatnie skuteczne przekazanie do SMTP; SMTP daje co najmniej raz.
- Katalog startowy: 4 usługi (`correction`, `ceramic`, `interior`, `wash`); edycja nazwy/ceny/czasu zapisuje `Service` dla studia; każda wycena ma snapshot `QuoteItem`.
- Terminy w kreatorze (`quoteSlots`) są **demonstracyjne** — nie rezerwują boksu i nie są częścią maila.
- `expired` istnieje w enumie, ale **nie ma crona wygasającego wyceny**.

### 9.8 Portal klienta

**Implementacja:** `app/p/[token]`, `src/server/portal/`, `components/portal/`.

- Link: 256-bit token, w bazie tylko SHA-256, TTL 14 dni, możliwość odwołania.
- Link ma dokładnie jeden cel: `quoteId` albo `workOrderId` (CHECK w migracji); FK pilnują tenanta.
- `GET /p/:token` niczego nie zmienia (bezpieczny dla skanerów poczty).
- Decyzja: `POST /p/:token/decision` z formularzem `accepted`/`rejected`; wymaga poprawnego `Origin`; 303 na ten sam link.
- Decyzja zmienia tylko `sent` z pustym `decidedAt`; jest atomowa i jednorazowa, także przy dwóch linkach.
- Decyzja nie tworzy zlecenia ani faktury; nie odwołuje linku do podglądu.
- W tej samej transakcji powstaje `QuoteDecisionMail` (bez tokenu/URL); worker wysyła powiadomienie do właścicieli.
- Nieprawidłowy, wygasły i odwołany token pokazują **ten sam P-02** bez danych studia.
- Nagłówki: `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow`; strona ma `robots: noindex`.
- P-01 (status zlecenia) jest **statyczną makietą** dla seedowego tokenu z zaakceptowaną wyceną. Dla pozostałych linków portal pokazuje wycenę i decyzję, ale nie pokazuje na żywo etapów zlecenia ani zdjęć.
- Akceptacja protokołu przyjęcia ma API (`POST .../protocol/accept`), ale **nie jest podłączona do portalu**.
- `app/p/quote-preview` to placeholder „wkrótce”.

### 9.9 Faktury

**Implementacja:** `app/(studio)/invoices/`, `components/faktury/`, `src/server/faktury/`, `src/invoices/`, `src/ksef/fa3.ts`.

#### Lista i „wymagają uwagi” (D-07/D-10)

- Wymaga `invoices:manage` (owner/manager); pracownik nie widzi faktur w sidebarze i nie może wejść na trasę.
- Czyta faktury wybranego środowiska (`studio.ksefEnv`), przez `studioDb`.
- Wyszukiwanie: numer, nabywca, NIP (także bez separatorów), numer zlecenia.
- Filtry statusów i nieopłaconych/zaległych; zaległość liczona od dnia po terminie w Europe/Warsaw.
- Paginacja: **7 dokumentów**, ale lista pobiera wszystkie faktury studia w danym środowisku i tnie je w UI.
- Licznik „do uwagi” obejmuje `issued` + `ksefStatus` `rejected`/`retrying`.
- Kwoty sumowane przez Decimal; karta brutto/VAT obejmuje przyjęte faktury, bez szkiców i odrzuceń.
- „Ponów”, „popraw NIP”, eksport JPK i offline to jawna demonstracja UI — nie zapisują zmian i nie wysyłają nic do MF.

#### Wystawianie

`POST /api/studios/:studioId/invoices` (owner/manager, Origin):

- tylko zlecenie `completed` z `completedAt`; inaczej 409,
- suma brutto faktury musi równać się `WorkOrder.totalGross`,
- jedna aktywna faktura na zlecenie w danym środowisku; zmiany korektą,
- środowisko KSeF pochodzi z konfiguracji studia, **nie z żądania**,
- nabywca: nazwa, adres, kod pocztowy, miasto; NIP opcjonalny, ale jeśli jest, musi przejść sumę kontrolną,
- pozycje: maks. 50, ilość > 0, VAT 23/8/5/0, cena netto,
- termin płatności `dueDays` 0–90 (domyślnie 7),
- numer `FV/n/MM/RRRR`; licznik `InvoiceCounter` osobno dla studia, środowiska, rodzaju i roku; brakujący startuje od najwyższego istniejącego numeru,
- transakcja Serializable; równoległe wystawienie → 409, nie duplikat,
- zapis `issued`, pozycji i eventu `issued` w jednej transakcji.

**Kreator D-08 jest nadal demo**: ładuje prawdziwe zakończone zlecenia i nabywcę, ale „Potwierdź wysyłkę (demo)” nie wywołuje POST. Fakturę można wystawić przez API.

#### Szczegóły, PDF i XML

- `GET /api/studios/:studioId/invoices/:invoiceId/:format?env=test|production` (owner/manager).
- `env` jest obowiązkowy; brak/zły → 400. `format` to `pdf` albo `xml`.
- Odpowiedzi są załącznikami z `Cache-Control: private, no-store` i `X-Content-Type-Options: nosniff`.
- PDF: `@react-pdf/renderer`, A4, lokalny Inter z polskimi znakami; dane z zapisanego snapshotu, nie przeliczane z brutto.
- XML: FA(3), namespace `http://crd.gov.pl/wzor/2025/06/25/13775/`, wariant 3, PLN, krajowy VAT 23/8/5/0, nabywca NIP albo `BrakID`. Korekty, zwolnienia i transakcje zagraniczne wymagają osobnego mapowania.
- Walidacja dokumentu odrzuca szkice, niezakończone zlecenia, ułamki grosza, niezgodne sumy i brutto różne od zlecenia (409).
- Eksport **nie ustawia `emailedAt`**; pobranie to nie wysyłka.
- PDF nie zawiera demonstracyjnego QR jako kodu weryfikacyjnego MF.
- UPO jest pobierane z `Invoice.ksefUpoXml`, jeśli istnieje; seed nie ma UPO.
- PDF/XML korekty nie są dostępne (409) — wymagają osobnego mapowania.

#### Korekta

`POST .../invoices/:invoiceId/corrections` (owner/manager):

- tylko faktura `issued` i `ksefStatus=accepted`,
- nie można korygować korekty,
- body: `reason` + pozycje po korekcie (`lp`, `quantity`, `unitNet`); ilość 0 usuwa pozycję, pominięte bez zmian,
- kwoty dokumentu to **różnica** względem stanu przed korektą (mogą być ujemne); kolejna korekta liczy od poprzedniej,
- numer `KFV/n/MM/RRRR`, ten sam nabywca i środowisko,
- pozycje korekty pokazywane jako różnice; eksport PDF/XML korekty jeszcze nie istnieje.

#### „Opłacona”

`POST .../invoices/:invoiceId/paid`:

- tylko faktura `issued`, nie korekta,
- `paidAt` opcjonalne ISO; nie z przyszłości (tolerancja 5 min) i nie przed wystawieniem,
- atomowe `paidAt: null` w warunku — drugi klik daje 409 i nie nadpisuje daty,
- płatność jest niezależna od KSeF i Stripe.

#### Numeracja i środowiska

- `FV/41/10/2026` jest numerem **w środowisku TEST**; TEST i PROD mają osobne liczniki i unikalność.
- `@@unique([studioId, ksefEnv, number])` oraz `@@unique([ksefEnv, ksefNumber])`.
- Seed FV/41 pochodzi z **#DF-0243** (zakończone 23.10.2026), nie z #DF-0248.
- Fakturę wystawia się po zakończeniu zlecenia; to nie jest FV/41 z #DF-0248.

### 9.10 KSeF 2.0 TEST

**Implementacja:** `src/ksef/`, `src/worker/ksef.ts`, `app/api/studios/[studioId]/ksef/token`.

- Domyślna ścieżka to **TEST**. `assertKsefTest()` odrzuca `KSEF_ENV` inne niż `test` oraz host inny niż `api-test.ksef.mf.gov.pl` (także przy `SKIP_ENV_VALIDATION=1`).
- PROD jest per studio (`Studio.ksefEnv`) i wymaga flagi `ksef_prod`. Badge w sidebarze i na karcie studia pokazuje TEST albo PROD. Właściciel przełącza środowisko na liście faktur; zmiana kasuje zapisany token.
- `KsefClient` implementuje: challenge, token RSA-OAEP/SHA-256, sesję FA(3), XML AES-256-CBC, status dokumentu, UPO XML, zamknięcie sesji. Timeout 20 s, bez przekierowań. Host wynika ze środowiska faktury: TEST albo `api.ksef.mf.gov.pl`. Tryb offline nie jest obsługiwany.
- Token studia jest szyfrowany AES-256-GCM. AAD i prefiks szyfrogramu wiążą go ze `studioId` i środowiskiem. TEST i PROD mają osobne klucze. Szyfrogram TEST nie odszyfruje się kluczem PROD.
- `PUT /api/studios/:studioId/ksef/token` wymaga `invoices:manage` i Origin. Środowisko bierze z studia, nie z body. Odpowiedź 204 **nie zwraca tokenu**. NIP jest sprawdzany dopiero przy kolejkowaniu faktury.
- `queueTestInvoice` jest **serwerowym punktem wejścia**: wymaga wystawionej faktury TEST po zakończonym zleceniu, waliduje XML, zapisuje niezmienny snapshot + SHA-256 + status `queued` + event `validated`, dopiero potem enqueue.
- Kolejka `ksef-test`: 10 prób, backoff 5 s–5 min, respektuje `Retry-After`; payload zawiera tylko `studioId` i `invoiceId`.
- Worker przed POST zapisuje `sendStartedAt` i referencję sesji; po utracie odpowiedzi szuka dokumentu po hashu w tej samej sesji i **nie wysyła ponownie**.
- Odrzucenie danych (np. 450/NIP), błędy uprawnień i 4xx poza 429 kończą zadanie przez `UnrecoverableError` i status `rejected`, bez automatycznego retry.
- Błędy przejściowe → `retrying`; po wyczerpaniu prób status `retrying` zostaje w D-10 z informacją dla operatora.
- UPO jest zapisywane w `Invoice.ksefUpoXml`; numer i data przyjęcia pochodzą z MF.
- Nie logujemy treści odpowiedzi MF ani wyjątków z danymi/sekretami.
- `recoverKsefOutbox()` co 15 s znajduje faktury TEST `queued` z submission i ponawia enqueue po awarii Redisa. Faktury PROD dochodzą tylko przy włączonej fladze.
- `queueKsefInvoice` bierze środowisko z faktury. Token o prefiksie TEST przy env PROD kończy się 409, zanim powstanie XML.
- **Brakuje:** publicznego route/akcji, która wywołuje `queueTestInvoice` z UI, oraz ekranu konfiguracji tokenu. Obecnie można zapisać token API, ale nie ma przycisku „Wyślij do KSeF”.
- Seed FV/41 jest demonstracją: 10:12:08 → 10:13:08, 60 s, DF-0243; brak `KsefSubmission` i UPO.

### 9.11 Stripe Billing

**Implementacja:** `src/server/billing/`, `app/(studio)/billing`, `app/api/stripe/webhook`, `app/api/studios/[studioId]/billing/`.

- Plany: Solo 7900 gr, Studio 14900 gr, Pro 27900 gr netto, miesięcznie, `tax_behavior=exclusive`.
- `pnpm billing:setup` tworzy brakujące produkty/ceny po `lookup_key`; ponowne uruchomienie weryfikuje istniejące ceny i **nie podmienia błędnej**. Osobno test i live.
- Checkout:
  - tylko owner,
  - tylko po trialu (albo po jego wygaśnięciu); przed końcem trialu 409,
  - `suspended` blokuje Checkout,
  - klient Stripe powstaje dopiero teraz, z metadanymi `studioId`,
  - otwarta sesja tego samego planu jest używana ponownie; inna jest wygaszana,
  - istniejący nieterminalny abonament blokuje kolejny, nawet przed pierwszym webhookiem,
  - `automatic_tax`, `tax_id_collection`, adres wymagany, locale `pl`,
  - success/cancel wracają na `/billing`; powrót nie nadaje dostępu.
- Webhook:
  - weryfikacja podpisu na `request.text()` (bez JSON.parse przed weryfikacją),
  - idempotencja `StripeEvent.id` w transakcji razem z aktualizacją `Studio` i `AuditLog`,
  - lock `pg_advisory_xact_lock` per studio serializuje Checkout i webhooki,
  - ponowny odczyt subskrypcji pod lockiem; opóźnione snapshoty nie cofają stanu,
  - weryfikacja `customerId`, `metadata.studioId`, pozycji (1 pozycja, quantity 1), planu i ceny,
  - mapowanie statusów: `active` → `active`, `trialing` → `trial`, `past_due` → `past_due`, `canceled`/`incomplete_expired` → `canceled`, `unpaid`/`paused`/`incomplete` → `suspended`,
  - `invoice.payment_failed` daje `past_due` tylko dla otwartej bieżącej faktury; opłacona/historyczna nie cofa stanu,
  - błąd → rollback i 500, Stripe ponawia.
- Customer Portal:
  - tylko owner; customer wyłącznie z rekordu studia, body nie wybiera customer ani return URL,
  - dostępny także w `past_due`/`suspended`/`canceled`, np. po poprawę karty,
  - konfiguracja domyślna w Stripe Dashboard osobno test/live.
- Trial:
  - 14 dni bez karty; brak klienta Stripe do Checkout,
  - `trialEndsAt` i `status=trial`; po wygaśnięciu status pozostaje `trial`, ale zapisy są zablokowane,
  - cron `billing-daily` o **06:00 Europe/Warsaw** + catch-up przy starcie; mail 3 dni przed końcem do ownerów,
  - `trialReminderSentAt` + lock chronią przed duplikatem; błąd SMTP cofa znacznik; 3 próby z backoffem,
  - stały Message-ID dla studia i daty końca trialu.
- Tryb ograniczony:
  - `active` i niewygasły `trial` pozwalają pisać,
  - `past_due`, `suspended`, `canceled`, wygasły trial → tylko odczyt,
  - brak dodatkowego grace period; sprawdzanie przy każdym żądaniu,
  - logowanie działa, layout pokazuje komunikat; owner ma link do `/billing`; worker ma prośbę do ownera,
  - wszystkie mutacje operacyjne (POST/PUT/PATCH/DELETE) → 403, w tym faktury, korekty, płatności, wyceny, zdjęcia, klienci, zlecenia,
  - zaproszenia przez Server Action też sprawdzają blokadę,
  - przełączanie studia i billing pozostają dostępne,
  - dane są zachowane; publiczne odpowiedzi klientów i wcześniej przyjęte zadania outbox/KSeF kończą obieg.
- MRR: `calculateMrr` liczy tylko `active`, netto PLN; trial/past_due/suspended/canceled wykluczone. Przykład audytu: 64×79 + 48×149 + 16×279 = **16 672 zł**. Funkcja **nie jest podłączona** do panelu admina.
- **Brak:** panelu A-01–A-10, egzekwowania limitów planów, raportów wpływów, retry Stripe w UI.

### 9.12 Zdjęcia i protokół przyjęcia

**Implementacja:** `src/server/zlecenia/photos.ts`, `intake.ts`, `lib/storage.ts`, API pod `/orders/[workOrderId]`.

- Bucket prywatny; klucz `studios/<studioId>/orders/<workOrderId>/<photoId>.<ext>`.
- `POST .../photos` rezerwuje numer, tworzy wiersz z `uploadedAt=null` i zwraca podpisany PUT (5 min) + wymagane nagłówki.
- Podpis obejmuje `Content-Type` i `Content-Length`; inny plik dostaje 403 od S3.
- `POST .../photos/confirm` robi `HeadObject` i sprawdza rozmiar/typ; niezgodny plik usuwa z S3 i bazy (400), brak pliku → 409. Dopiero potem zdjęcie jest widoczne; wywołanie idempotentne.
- `GET .../photos` zwraca zdjęcia po numerze z metadanymi i podpisanym GET (5 min).
- Limity: 20 MB, JPEG/PNG/WebP/HEIC, `stage` 1–4, `caption` do 200 znaków.
- Klucz spoza prefiksu studia → 403 przed dotknięciem bazy/S3; zły kształt klucza → 400.
- Porzucone, niepotwierdzone wiersze zostają w bazie; **brak sprzątania** osieroconych obiektów.
- Protokół: jeden na zlecenie, numer `P-0248` z `DF-0248`, maks. 30 punktów, pozycja `x`/`y` jako ułamek 0–1, opcjonalne zdjęcie **tego samego zlecenia**.
- Po akceptacji protokół jest niezmienny (409), także przy równoległym zapisie; akceptacja jest idempotentna.
- UI D-04 nadal pokazuje dane demo i dialog „wkrótce”; API jest gotowe.

### 9.13 Zespół

**Implementacja:** `app/(studio)/team`, `src/server/studio/invitations.ts`.

- `/team` tylko owner/manager; formularz zaproszenia (e-mail + rola manager/worker).
- Wysłanie przez SMTP; przy braku SMTP w dev mail trafia do logu, w produkcji błąd.
- Link `/invite/[token]`; nowe konto bez hasła może zalogować się magicznym linkiem.
- Po przyjęciu cookie aktywnego studia ustawiane jest na zaproszone studio.
- Brak listy członków, zmiany roli, usuwania i dezaktywacji.

### 9.14 Landing

**Implementacja:** `app/(marketing)/landing`, `components/landing`, `lib/landing/`.

- Jeden responsywny układ L-01/L-02; L-03 to pełnoekranowe menu mobilne.
- Gość na `/` dostaje rewrite na `/landing`, URL pozostaje `/`.
- Cennik: tylko miesięczny netto 79/149/279; brak przełącznika rocznego.
- Brak fikcyjnych opinii, gwiazdek i logotypów klientów; zamiast tego „SCENARIUSZ DEMO”.
- Kalkulator oszczędności jest **estymacją** na Decimal, z jawnymi założeniami; nie mierzy wyników klientów.
- „Zobacz demo (2 min)” to placeholder przewijający do podglądu pulpitu.
- Podgląd pulpitu to statyczna kopia D-01; zmiany D-01 trzeba przenieść ręcznie.
- Stopka nie linkuje do nieistniejących stron.
- Obietnice (KSeF, import Excel, brak karty, polski support) wymagają zatwierdzenia prawnego; część jest jeszcze przed implementacją (np. import XLSX, pełna wysyłka KSeF).

### 9.15 Panel platformy (poza implementacją)

`audit/admin/README.md` opisuje A-01–A-10: MRR, studia, kartę konta, abonamenty, analitykę, system/KSeF, wsparcie, administrację, sesję wsparcia 15 min i zawieszenie konta. To **projekt UX i definicje metryk**, nie działający panel. W kodzie nie ma `/admin`, MFA ani sesji wsparcia.

### 9.16 Design system i frontend

- Produkt jest **dark-only**; brak trybu jasnego.
- Kolory wyłącznie z tokenów `--df-*` w `app/globals.css`; komponenty nie powinny używać surowych hexów.
- Tailwind v4 mapuje tokeny na klasy `bg-df-*`, `text-df-*`, `border-df-*`, `font-brand`.

| Token | Wartość | Zastosowanie |
| --- | --- | --- |
| `--df-bg` | `#101214` | tło aplikacji |
| `--df-side` | `#17191C` | sidebar |
| `--df-panel` | `#1B1E21` | panele i karty |
| `--df-raised` | `#24282C` | podniesione elementy, hover |
| `--df-line` | `#30353A` | separatory i obramowania |
| `--df-text` | `#F2F4F5` | tekst główny |
| `--df-muted` | `#9CA5AC` | tekst pomocniczy |
| `--df-lime` | `#D3F66A` | akcja główna, praca w toku |
| `--df-blue` | `#A7C8FF` | zaplanowane, do odbioru |
| `--df-amber` | `#F0C589` | szkic, zaległość, ostrzeżenie |
| `--df-green` | `#8ED9B0` | zaakceptowane, zakończone |
| `--df-error` | `#FF6B6B` | błąd, odrzucenie KSeF |

Typografia:

- **Inter**: Label 12, Body 13, Strong 14, Section 17, Headline/Number 30; line-height 1.4.
- **Space Grotesk**: wordmark `detailflow`, 20/28, waga 700, letter-spacing −0.55 px.
- Fonty są lokalne (`app/fonts`), bez pobierania z Google podczas builda; licencje OFL w katalogu.

Layout:

- sidebar 220 px, topbar 72 px + 1 px separator, workspace padding 28 px (desktop),
- próg mobilny `lg` = **1024 px**; poniżej sidebar i topbar znikają, pojawia się tab bar,
- tab bar ma `env(safe-area-inset-bottom)`; treść dostaje dolny padding, żeby nie wchodziła pod pasek,
- portal klienta ma maks. 390 px i przyciski min. 44 px.

Komponenty i dostępność:

- `Button` (primary/secondary, stany default/hover/focus/disabled/loading), `Input`, `Badge` (9 wariantów + rozszerzenia), `Sidebar`, `TabBar`, `Sheet` na natywnym `<dialog>`,
- focus globalny: 2 px lime + offset 2 px; nie usuwaj outline klasami,
- badge są nieinteraktywne i nie mają tab stopu,
- skeletony mają `role="status"` i `aria-busy`; puls tylko przy `prefers-reduced-motion: no-preference`,
- animacje sheetu także respektują reduced motion,
- `NotFoundState`, `EmptyState`, `NoResultsState`, `NetworkError` są wspólne; nie duplikuj ich w ekranach,
- wydruk faktury: `@media print` ukrywa wszystko poza `.df-invoice-paper`.

Assety: logo Flowcut w `branding/`, ikony i zdjęcia demo w `public/`; część SVG pochodzi bezpośrednio z Figmy. Nie podmieniaj zdjęć demo na zdjęcia innych aut — brak zdjęcia w modelu jest pokazywany jako placeholder.

---

## 10. API

### 10.1 Konwencje

- API jest wewnętrzne dla aplikacji, bez wersjonowania i bez generowanego OpenAPI.
- Autoryzacja: cookie sesji Better Auth + membership + rola.
- Zapisy wymagają nagłówka `Origin` równego originowi `APP_URL`; inaczej **403**.
- Błędy zwykle mają postać `{ "error": "komunikat" }`.
- Kody:
  - **200/201/202/204** — sukces,
  - **400** — walidacja, zły format, brak wymaganego parametru,
  - **401** — brak sesji,
  - **403** — brak membershipu/roli, zły Origin, tryb tylko do odczytu,
  - **404** — brak rekordu lub rekord innego studia (celowo ten sam kod),
  - **409** — konflikt, niezmienny dokument, zły stan, duplikat,
  - **503** — Stripe nieskonfigurowany,
  - **500** — błąd nieoczekiwany; webhook Stripe ma wtedy ponowić.
- `studioId` w ścieżce to **ID studia**, nie slug. `workOrderId`/`invoiceId` to **ID rekordu**, nie numer `DF-…`/`FV/…`.
- Strona szczegółów faktury używa numeru w URL, ale API używa `invoiceId`.

### 10.2 Endpointy

#### Publiczne i auth

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `GET` | `/api/health` | publiczny | `{ status, time, checks: { db, redis } }`. 200 gdy oba żyją, inaczej 503. Nie sprawdza S3 i nie zwraca szczegółów połączenia |
| `GET/POST` | `/api/auth/[...all]` | publiczny | Better Auth (login, magic link, reset itd.) |
| `GET` | `/p/:token` | token | portal; brak efektów ubocznych |
| `POST` | `/p/:token/decision` | token + Origin | decyzja o wycenie; formularz, 303 |
| `GET` | `/p/quote-preview` | publiczny | placeholder „wkrótce” |

#### Studio i billing

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `POST` | `/api/studios/active` | sesja + `studio:select` + Origin | zapis aktywnego studia w cookie |
| `POST` | `/api/studios/:studioId/invitations` | owner/manager + Origin | zaproszenie `{ email, role }` |
| `POST` | `/api/studios/:studioId/billing/checkout` | owner + Origin | `{ plan }` → `{ url }` |
| `POST` | `/api/studios/:studioId/billing/portal` | owner + Origin | `{ url }` do Customer Portal |
| `POST` | `/api/stripe/webhook` | podpis Stripe | idempotentny webhook |

#### Klienci i auta

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `GET` | `/api/studios/:studioId/clients?page=&q=` | sesja | 20/stronę, szukanie |
| `POST` | `/api/studios/:studioId/clients` | sesja + Origin | nowy klient, opcjonalnie auto; `warnings` |
| `GET/PATCH/DELETE` | `/api/studios/:studioId/clients/:clientId` | sesja (+ Origin dla zapisu) | karta/edycja/usunięcie; 409 przy historii |
| `POST` | `/api/studios/:studioId/clients/:clientId/vehicles` | sesja + Origin | dodanie auta |
| `PATCH/DELETE` | `/api/studios/:studioId/vehicles/:vehicleId` | sesja + Origin | edycja/usunięcie auta |
| `POST` | `/api/studios/:studioId/clients/import` | sesja + Origin | CSV w JSON, `text/csv` lub multipart `file` |

#### Kalendarz

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `GET` | `/api/studios/:studioId/bookings` | sesja | rezerwacje bez anulowanych |
| `GET` | `/api/studios/:studioId/bookings/:workOrderId` | sesja | jedna rezerwacja |
| `POST` | `/api/studios/:studioId/bookings/:workOrderId` | sesja + Origin | przypisz boks (201) |
| `PUT` | `/api/studios/:studioId/bookings/:workOrderId` | sesja + Origin | zmień rezerwację (200) |
| `DELETE` | `/api/studios/:studioId/bookings/:workOrderId` | sesja + Origin | zwolnij boks (204) |

#### Zlecenia, zdjęcia i protokół

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `GET` | `/api/studios/:studioId/orders/:workOrderId/photos` | sesja | lista zdjęć + podpisane URL-e |
| `POST` | `/api/studios/:studioId/orders/:workOrderId/photos` | sesja + Origin | rezerwacja uploadu, podpisany PUT |
| `POST` | `/api/studios/:studioId/orders/:workOrderId/photos/confirm` | sesja + Origin | potwierdzenie uploadu |
| `GET` | `/api/studios/:studioId/orders/:workOrderId/protocol` | sesja | protokół + punkty |
| `PUT` | `/api/studios/:studioId/orders/:workOrderId/protocol` | sesja + Origin | utwórz/zastąp punkty |
| `POST` | `/api/studios/:studioId/orders/:workOrderId/protocol/accept` | sesja + Origin | akceptacja klienta (flaga) |
| `GET` | `/api/studios/:studioId/orders` | `orders:write` | lista zleceń studia |
| `POST` | `/api/studios/:studioId/orders` | `orders:write` + Origin | utworzenie z historią (201), kwota jako tekst dziesiętny |
| `GET` | `/api/studios/:studioId/orders/:workOrderId` | `orders:write` | zlecenie po id lub `DF-####` |
| `POST` | `/api/studios/:studioId/orders/:workOrderId/status` | `orders:update` + Origin | `{ status }`, maszyna stanów |
| `POST` | `/api/studios/:studioId/orders/:workOrderId/advance` | `orders:update` + Origin | następny etap, bez body |

#### Wyceny i portal

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `GET` | `/api/studios/:studioId/quotes/:quoteId` | owner/manager | odczyt wyceny |
| `PUT` | `/api/studios/:studioId/quotes/:quoteId` | owner/manager + Origin | zapis szkicu i pozycji (Serializable) |
| `POST` | `/api/studios/:studioId/quotes/:quoteId/send` | owner/manager + Origin | `sent` + outbox, 202 |
| `POST` | `/api/studios/:studioId/portal-links` | `orders:update` + Origin | `{ quoteId }` lub `{ workOrderId }` → `{ id, expiresAt, path }` (201) |
| `DELETE` | `/api/studios/:studioId/portal-links/:linkId` | `orders:update` + Origin | odwołanie linku (204, idempotentne) |

#### Faktury i KSeF

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `POST` | `/api/studios/:studioId/invoices` | owner/manager + Origin | wystawienie FV (201) |
| `GET` | `/api/studios/:studioId/invoices/:invoiceId` | owner/manager | rekord faktury |
| `POST` | `/api/studios/:studioId/invoices/:invoiceId/paid` | owner/manager + Origin | oznaczenie płatności |
| `POST` | `/api/studios/:studioId/invoices/:invoiceId/corrections` | owner/manager + Origin | korekta (201) |
| `GET` | `/api/studios/:studioId/invoices/:invoiceId/pdf?env=test\|production` | owner/manager | PDF |
| `GET` | `/api/studios/:studioId/invoices/:invoiceId/xml?env=test\|production` | owner/manager | FA(3) XML |
| `PUT` | `/api/studios/:studioId/ksef/token` | owner/manager + Origin | zapis tokenu TEST (204); NIP wymagany dopiero przy wysyłce |

Brak endpointu do enqueue faktury do KSeF.

### 10.3 Przykład wywołania

```bash
# Wymaga ciasteczka sesji z przeglądarki oraz dokładnego Origin.
curl -X POST "http://localhost:3000/api/studios/$STUDIO_ID/invoices" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -H "Cookie: $SESSION_COOKIE" \
  -d '{
    "workOrderId": "'$ORDER_ID'",
    "buyer": {
      "name": "Adam Nowak",
      "street": "ul. Puławska 120/4",
      "postal": "02-620",
      "city": "Warszawa"
    },
    "items": [
      { "name": "Korekta lakieru", "quantity": "1", "unitNet": "1951.22", "vatRate": 23 }
    ],
    "dueDays": 7
  }'
```

Suma brutto musi równać się `totalGross` zlecenia; w przeciwnym razie API zwróci 400/409.

---

## 11. Reguły biznesowe

### 11.1 Pieniądze

- Waluta: **PLN**.
- Wszystkie kwoty w bazie i domenie: `Decimal`, nigdy `float`.
- Przeliczenia:
  - wycena: brutto = suma baz × rozmiar × lakier; VAT = brutto × 23/123,
  - faktura: netto pozycji = cena netto × ilość; VAT = netto × stawka; brutto = netto + VAT,
  - zaokrąglanie: HALF_UP do grosza na pozycję/sumę.
- `Invoice.totalNet/Vat/Gross` to zapisany snapshot; eksporty nie przeliczają netto z brutto.
- `WorkOrder.totalGross` i `Quote.totalGross` są brutto.
- `InvoiceItem.quantity` ma 3 miejsca po przecinku; kwoty 2.

### 11.2 Czas

- Baza: UTC.
- Strefa biznesowa: `Europe/Warsaw`.
- Kalendarz przyjmuje czas lokalny Warszawy albo jawne ISO z offsetem; niejednoznaczne godziny w zmianie czasu są odrzucane.
- Granice miesiąca, „dziś”, zaległość i obłożenie liczone w Warszawie, nie w UTC.

### 11.3 Numeracja

| Dokument | Format | Licznik |
| --- | --- | --- |
| Zlecenie | `DF-0248` | `OrderCounter` per studio |
| Faktura | `FV/41/10/2026` | `InvoiceCounter` per studio + env + rok + kind |
| Korekta | `KFV/1/10/2026` | osobny `kind=correction` |

- Brakujący licznik startuje od najwyższego istniejącego numeru (seed FV/41 → następna FV/42).
- TEST i PROD nie dzielą numeracji.
- Równoległe wystawienie ma dać 409, nie duplikat.

### 11.4 Statusy

- `WorkOrder.status` to status operacyjny; `stage` to etap 1–4.
- `Invoice.status` to stan dokumentu (`draft`, `issued`, `canceled`); płatność to `paidAt`, a KSeF to `ksefStatus`.
- `Quote.status` to stan wyceny; `expired` nie jest jeszcze automatyzowany.
- `Studio.status` to stan billingu; `trial` po wygaśnięciu nadal jest `trial`, ale zapisy są zablokowane.

### 11.5 Ważne zakazy

- Nie wystawiaj faktury z aktywnego zlecenia.
- Nie wystawiaj drugiej aktywnej faktury na to samo zlecenie w tym samym środowisku.
- Nie koryguj korekty ani faktury nieprzyjętej w KSeF.
- Nie edytuj wysłanej wyceny.
- Nie zmieniaj zaakceptowanego protokołu.
- Nie mieszaj TEST i PROD KSeF.
- Nie używaj `platformDb` w kodzie studia.
- Nie dodawaj modelu operacyjnego bez `studioId` i wpisu w `TENANT_MODELS`.
- Nie loguj surowych tokenów portalu, sekretów KSeF ani payloadów Stripe.

---

## 12. Bezpieczeństwo i RODO

### 12.1 Co jest wdrożone

- **Izolacja tenantów** w aplikacji (`studioDb`) i w bazie (złożone FK); testy dwóch studiów.
- **Hasła** Argon2id; **sesje** w Postgresie; cookie httpOnly; `safeNext`.
- **CSRF**: zapisy API i Server Actions wymagają dokładnego `Origin`; portal decyduje tylko POST-em.
- **Tokeny portalu**: 256 bitów, SHA-256 w bazie, TTL 14 dni, odwołanie; brak tokenu w logach/outboxie.
- **S3**: bucket prywatny, presigned URL 5 min, podpisany Content-Type i długość, prefix per studio.
- **Stripe**: weryfikacja podpisu, idempotencja, lock per studio, walidacja tenanta i subskrypcji.
- **KSeF**: TEST domyślnie; PROD per studio za flagą `ksef_prod`. Token AES-256-GCM z AAD `studioId` i środowiska, osobny klucz PROD. Brak surowych błędów MF w logach.
- **Nagłówki**: CSP, `X-Frame-Options`, `nosniff`, Permissions-Policy. Portal dodatkowo `no-referrer`, `no-store`, `noindex`.
- **Lockout logowania**: 5 błędnych haseł w 15 min blokuje ten adres na 15 min. W bazie jest hash, nie e-mail. Rate limit auth w pamięci procesu zostaje (nie jest współdzielony między instancjami).

### 12.2 Czego brakuje

- MFA i osobnej sesji administratora platformy,
- sesji wsparcia 15 min i audytu dostępu admina,
- pełnego `AuditLog` dla operacji studia (obecnie tylko billing),
- rate limitingu API poza auth,
- szyfrowania backupów,
- eksportu/usunięcia danych klienta (RODO),
- Sentry/monitoringu i alertów,
- testów E2E i testów obciążeniowych uploadu.

### 12.3 RODO — praktyczne uwagi

- Zdjęcia aut mogą zawierać tablice rejestracyjne i elementy otoczenia; to dane osobowe.
- Konieczna jest umowa powierzenia ze studiem. Retencja zdjęć: prywatny bucket, URL 5 min, prefix per studio; v1 nie kasuje automatycznie zdjęć zakończonych zleceń (okres prawny nie jest ustawiony). Szczegóły w `docs/dokumentacja-wdrozenia.md` §10.1.
- Token portalu jest sekretem bearer; nie może trafić do logów, analityki, APM ani historii e-maili.
- `next.config.ts` wyłącza logowanie pełnych URL w dev, ale proxy/APM trzeba skonfigurować osobno, żeby maskowały `/p/*` i body odpowiedzi z linkiem.
- Przed produkcją: regulamin, polityka prywatności, zgody marketingowe, DPA, procedura naruszenia.

---

## 13. Testowanie i jakość

### 13.1 Uruchamianie

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Testy integracyjne wymagają PostgreSQL po migracjach. Testy S3/MinIO i Redis/KSeF są opcjonalne lub warunkowe:

| Zmienna | Efekt |
| --- | --- |
| `DATABASE_URL` | wymagane przez większość testów |
| `S3_TEST_ENDPOINT` | włącza test prawdziwego MinIO |
| `KSEF_REDIS_TEST_URL` | włącza test prawdziwego BullMQ/Redis |
| `xmllint` w PATH | wymagany do walidacji XSD FA(3) |

### 13.2 Co jest pokryte

- **Domena:** cena, VAT, zaokrąglanie, czas, katalog, oszczędności landingu.
- **Tenant:** `studioDb` (where/data/update/upsert, blokady), dwa studia w testach.
- **Auth:** hasła, redirect, sesje, rejestracja, zaproszenia, role, CSRF/Origin.
- **Billing:** plany, Checkout, webhooki, idempotencja, race, retry, trial, MRR, read-only.
- **Klienci:** CSV, 20/stronę, duplikat tablicy, izolacja.
- **Kalendarz:** kolizje, DST, CRUD, równoległe zapisy.
- **Zlecenia:** przejścia, etapy, historia, numeracja, `canInvoice`.
- **Wyceny:** zapis, wysyłka, outbox, błąd SMTP, link portalu.
- **Portal:** hash/TTL/revoke, P-02, decyzja, wyścig dwóch linków.
- **Faktury:** walidacja dokumentu, PDF, FA(3), XSD, numeracja TEST/PROD, korekty, płatność.
- **KSeF:** kontrakt HTTP z podmienionym transportem, kryptografia, worker, retry, UPO, restart.
- **UI:** kluczowe ekrany, stany, dostępność podstawowa, mobile.

### 13.3 CI

`.github/workflows/ci.yml` ma trzy joby:

1. **typecheck + build:** `prisma validate`, `lint`, `typecheck`, `build` z `SKIP_ENV_VALIDATION=1`.
2. **migrate + seed + test:** PostgreSQL 16 + Redis 7, `migrate deploy`, `migrate diff --exit-code`, seed **dwa razy** (test resetu), `libxml2-utils`, `pnpm test`.
3. **docker build:** build target `runner`.

Brak progu coverage i brak E2E Playwright w CI.

### 13.4 Zasady testów

- Nie używaj produkcyjnej bazy ani produkcyjnego Redisa.
- Testy integracyjne kasują/odtwarzają dane demo; używaj osobnej bazy.
- Testy współdzielą stan w ramach pliku; `fileParallelism: false` chroni przed równoległym seedem.
- Testy KSeF **nie łączą się z MF**; używają transportu zastępczego.
- Certyfikaty w `src/ksef/fixtures/test-only-*` służą tylko testom jednostkowym; nie są sekretami produkcyjnymi.
- Po zmianie schematu zawsze sprawdź `prisma migrate diff`.

---

## 14. Wdrożenie i utrzymanie

### 14.1 Obraz

`Dockerfile` ma etapy:

- `deps` — instalacja z `pnpm-lock.yaml`,
- `dev` — kod montowany z hosta w Compose,
- `migrate` — `prisma migrate deploy` jako osobny krok,
- `builder` — build Next.js standalone + worker bundle,
- `runner` — non-root `nextjs` (uid 1001), `node server.js`, healthcheck `/api/health`.

Worker uruchamia się z **tego samego obrazu**:

```bash
node dist/worker.mjs
```

Wymaga `DATABASE_URL`, `REDIS_URL`, `S3_*`, `AUTH_SECRET`, `APP_URL` i konfiguracji SMTP. KSeF dodatkowo `KSEF_*`; billing `STRIPE_*`.

### 14.2 Kolejność wdrożenia

1. Zbuduj i opublikuj obraz (tag = wersja).
2. Uruchom migracje **przed** startem web:

   ```bash
   docker run --rm --env-file .env <image> pnpm prisma migrate deploy
   ```

   albo użyj targetu `migrate`.
3. Uruchom web (port 3000, za reverse proxy).
4. Uruchom worker (ten sam obraz, inna komenda).
5. Sprawdź `/api/health`, logi i kolejkę.
6. Dopiero potem włącz ruch.

### 14.3 Wymagane usługi

- PostgreSQL 16 (backup + PITR zalecane),
- Redis 7 (BullMQ; może być zarządzany),
- S3-compatible storage (MinIO/R2) z prywatnym bucketem,
- SMTP (Mailpit lokalnie, dostawca produkcyjny),
- reverse proxy z HTTPS (Caddy/Traefik/nginx),
- Stripe (test/live) i KSeF TEST.

### 14.4 Checklist produkcyjny

- [ ] `APP_URL` = publiczny HTTPS origin; żadnego `localhost`.
- [ ] `AUTH_SECRET` losowy, poza repo.
- [ ] `DATABASE_URL` do produkcyjnej bazy; migracje z `migrate deploy`.
- [ ] `S3_PUBLIC_ENDPOINT` osiągalny z przeglądarki; bucket prywatny.
- [ ] `SMTP_URL` i `EMAIL_FROM` działają; test magic linku i resetu.
- [ ] `STRIPE_SECRET_KEY` live, `STRIPE_WEBHOOK_SECRET` live, endpoint `POST /api/stripe/webhook`.
- [ ] `pnpm billing:setup` z kluczem live; ceny i `lookup_key` zgodne.
- [ ] Stripe Tax i Customer Portal skonfigurowane osobno dla live.
- [ ] `KSEF_ENV=test`, `KSEF_API_URL` test, `KSEF_TOKEN_ENCRYPTION_KEY` 32 bajty.
- [ ] Worker działa i ma połączenie z Redis/SMTP/KSeF.
- [ ] `SENTRY_DSN` (i ewentualnie `NEXT_PUBLIC_SENTRY_DSN`) wskazują projekt Sentry. Bez DSN błędy nie wychodzą z procesu.
- [ ] `pnpm backup` przechodzi, a serwis `backup` zostawia dumpy w `BACKUP_S3_PREFIX` i kasuje starsze niż `BACKUP_RETENTION_DAYS`. Odtworzenie: `pg_restore` na kopię.
- [ ] Alerty na 503 z `/api/health` i na nowe issue w Sentry (poza repo).
- [ ] Reverse proxy maskuje `/p/*` w logach i body odpowiedzi.
- [ ] Regulamin, polityka prywatności, DPA, zgody.
- [ ] Test zakupu kartą testową i webhooka; test reseed na kopii.

### 14.5 Backup i odtwarzanie

- Backup: `pnpm backup` albo serwis Compose `backup` (`pg_dump --format=custom`, plik `backups/postgres/detailflow-….dump` w prywatnym buckecie). Hasło bazy idzie przez `PGPASSWORD`, nie przez argumenty procesu. Retencja domyślnie 14 dni; najnowszy dump zostaje nawet, gdy jest starszy. Osobnego klucza szyfrującego dumpa nie ma w aplikacji — na produkcji włącz SSE bucketa i osobne konto S3 tylko do backupu.
- Odtwarzanie: `pg_restore --no-owner` do osobnej bazy, `migrate deploy`, smoke test, dopiero potem przełączenie.
- Backup powinien obejmować też bucket S3 (zdjęcia, UPO) albo mieć politykę odtwarzania obiektów.
- Logi i metryki nie mogą zawierać tokenów portalu, sekretów KSeF, payloadów Stripe ani danych klientów.

### 14.6 Skalowanie

- Aplikacja jest bezstanowa (poza cookie); można uruchomić wiele instancji web.
- Rate limit auth jest w pamięci procesu — przy wielu instancjach przenieś do Redisa.
- Workerów nie skaluj bez analizy: outbox ma blokady wierszy, ale kolejność locków i idempotencja muszą zostać zachowane.
- KSeF worker ma `concurrency: 2`; zwiększanie wymaga testów limitów MF.
- Next dev nie jest produkcyjny; używaj `pnpm build` + `pnpm start`/standalone.

---

## 15. Luki i plan

### 15.1 Luki krytyczne dla v1

| Luka | Wpływ | Co trzeba zrobić |
| --- | --- | --- |
| Brak tworzenia zleceń (API/UI) | nie da się prowadzić nowego auta | endpointy + formularz + podłączenie kalendarza/pulpitu |
| Brak zapisu statusu/etapu z UI | pracownik nie może przesuwać pracy | podłączyć `transitionOrder`/`advanceStage` do API i D-03/D-04/M-04 |
| Kreator faktury nie wystawia FV | faktura tylko przez API | wywołać `POST /invoices` z wizarda, obsłużyć 409/400 |
| Brak enqueue KSeF z UI | brak realnej wysyłki do MF | route/akcja `queueTestInvoice` + ekran tokenu i statusu |
| Brak maila z fakturą | klient nie dostaje PDF | outbox `InvoiceMail` + worker + „Wyślij ponownie” |
| Panel admina nie istnieje | brak operacji SaaS | A-01–A-10 na agregatach i audycie |
| Brak MFA/admin sesji | ryzyko bezpieczeństwa | TOTP, role platformy, sesja wsparcia 15 min, audyt |

### 15.2 Luki ważne, ale nieblokujące

- status zlecenia i zdjęcia w portalu dla dowolnego linku (P-01 jest statyczne),
- akceptacja protokołu w portalu,
- wygasanie wycen (`expired`) i przypomnienia,
- sprzątanie niepotwierdzonych zdjęć,
- wysyłka SMS,
- wyszukiwarka ⌘K,
- limity planów i egzekwowanie liczby użytkowników/boksów,
- lista członków, zmiana roli, usunięcie z zespołu,
- PDF/XML korekty,
- eksport JPK,
- panel błędów KSeF i ręczne ponawianie,
- CSP/HSTS, Sentry, metryki, E2E.

### 15.3 Kierunek rozwoju

Zgodnie z dokumentacją wdrożenia budujemy **pionami wartości**, nie „najpierw cały admin”:

1. fundament: auth, tenant, seed, shell, CI — **zrobione**,
2. operacje: klienci, zlecenia, kalendarz, pulpit, zdjęcia — **częściowo** (brak create/status UI),
3. pieniądz studia: wycena, portal, faktury, KSeF — **częściowo** (brak enqueue i maila FV),
4. SaaS: landing, trial, Stripe — **zrobione**,
5. platforma: A-01–A-10 — **brak**,
6. twardnienie: KSeF PROD, E2E, backup, monitoring, prawo — **brak**.

Priorytet najbliższego etapu: **domknąć obieg zlecenia i faktury end-to-end**, bo bez tego produkt nie prowadzi dnia studia mimo gotowych modułów domenowych.

---

## 16. Dokumentacja źródłowa

| Dokument | Co zawiera |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | zasady pracy agentów, etykiety, twarde reguły produktu |
| [`docs/dokumentacja-wdrozenia.md`](docs/dokumentacja-wdrozenia.md) | pierwotna specyfikacja produktu, architektury, Prisma, Stripe, KSeF, faz |
| [`docs/README.md`](docs/README.md) | indeks dokumentacji |
| [`file-structure.md`](file-structure.md) | mapa ekranów Figmy, dane demo, zakres prototypu |
| [`audit/admin/README.md`](audit/admin/README.md) | definicje metryk i panelu platformy A-01–A-10 |
| [`docs/naprawa-migracji-coating-reminders.md`](docs/naprawa-migracji-coating-reminders.md) | procedura naprawy historii migracji |
| [`src/server/README.md`](src/server/README.md) | ACL, zlecenia, wyceny, klienci — skrót |
| [`src/server/billing/README.md`](src/server/billing/README.md) | Stripe, webhooki, trial, read-only, MRR |
| [`src/ksef/README.md`](src/ksef/README.md) | KSeF TEST, token, worker, retry |
| [`src/server/zlecenia/README.md`](src/server/zlecenia/README.md) | zdjęcia, protokół, stan zlecenia |
| [`src/server/wyceny/README.md`](src/server/wyceny/README.md) | zapis i wysyłka wycen |
| [`src/server/portal/README.md`](src/server/portal/README.md) | tokeny i decyzja portalu |
| [`src/server/klienci/README.md`](src/server/klienci/README.md) | CRUD, CSV, paginacja |
| [`src/server/kalendarz/README.md`](src/server/kalendarz/README.md) | rezerwacje i kolizje |
| [`components/*/README.md`](components) | szczegóły ekranów i odstępstw od Figmy |
| [`branding/`](branding) | logo Flowcut (SVG) |
| [Figma](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S) | źródło prawdy UI |
| [Issues](https://github.com/JaMkAAaa/detailflow/issues) | backlog, epiki, zadania `agent-ready` |

**Uwaga o rozbieżności:** `docs/dokumentacja-wdrozenia.md` opisuje docelowy produkt i miejscami wyprzedza kod (np. panel admina, KSeF PROD, pełne Ustawienia). Ten README opisuje **stan faktyczny** i wskazuje luki. Przy sprzeczności: kod i migracje > ten README > dokumentacja wdrożenia > makieta.

---

## 17. Praca z repozytorium

### 17.1 Zasady z `AGENTS.md`

- Bierz **jedno issue**, nie cały epik.
- `type:epic` to spis; nie otwieraj PR „zamyka epik” bez issue składowych.
- `type:ui` = ekran 1:1 z Figmy, dane mogą być seed/mock.
- `type:implement` = model, API, worker, integracja; podłącz istniejący UI, nie przerabiaj makiety.
- `agent-ready` = kontekst wystarcza do startu.
- Nie ruszaj issue z innej fazy, jeśli `Blocked by` nie są zamknięte.

### 17.2 Twarde reguły produktu

- Multi-tenant: każde zapytanie operacyjne ma `studioId`; `studioDb(studioId)`, nie „pamiętaj where”.
- Stripe = abonament Detailflow; KSeF = faktura klienta studia. Nie mieszaj.
- Faktury wystawia się po zakończeniu zlecenia; FV/41 nie powstaje z #DF-0248.
- Portal klienta: 3 etapy, nie 4; token hashowany, surowy tylko w URL.
- Kwoty: `Decimal`, PLN, nigdy `float`.
- Poza v1: magazyn, statystyki, portfolio, pełny cennik CMS, KSeF offline, abonament roczny, płatność online klienta.
- Menu „Usługi i cennik / Magazyn / Statystyki / Portfolio” = „Wkrótce”, nie 404 i nie pusty CRUD.
- Seed odtwarza dane makiety, żeby dało się porównać UI.

### 17.3 Stack — czego nie dodawać

Next.js 15 App Router, PostgreSQL 16, Prisma (migracje), Docker Compose, Stripe Billing, Tailwind + tokeny `--df-*`, Better Auth, BullMQ, S3/MinIO. **Nie dodawaj** Clerka, GraphQL, Nesta, Kafki „przy okazji”.

### 17.4 PR

- Tytuł: `feat(zlecenia): …`, `ui(pulpit): …`, `fix(ksef): …`.
- Opis: `Closes #n`, link do Figmy, checklista z issue.
- Test izolacji tenantów, jeśli ruszasz zapytania.
- `prefers-reduced-motion` przy animacjach.
- Nie commituj `.env`, sekretów, tokenów, certyfikatów produkcyjnych.
- Nie uruchamiaj `db push` na produkcji.

### 17.5 Konwencje kodu

- TypeScript strict, `noUncheckedIndexedAccess`.
- Import alias `@/*`.
- Kwoty przez `Decimal`/`Prisma.Decimal`; formatowanie do stringów z dwoma miejscami.
- Komponenty UI z `components/ui`, stany z `components/states`; nie duplikuj.
- Kolory tylko z tokenów `--df-*`; focus 2 px + offset 2 px.
- Daty: `Intl` z `timeZone: "Europe/Warsaw"`; nie licz „dziś” w UTC.
- Nowe modele operacyjne: `studioId`, złożone FK, wpis w `TENANT_MODELS`, migracja, test dwóch tenantów.

---

## 18. Słownik

| Pojęcie | Znaczenie |
| --- | --- |
| **Studio / tenant** | jedna firma detailingowa; granica izolacji danych |
| **Boks** | stanowisko pracy; `Bay` |
| **Zlecenie** | `WorkOrder`, numer `DF-####`; etapy 1–4 |
| **Wycena** | `Quote` z pozycjami i mnożnikami; może być wysłana i zaakceptowana |
| **FA(3)** | polski schemat XML faktury VAT dla KSeF |
| **KSeF** | Krajowy System e-Faktur; w kodzie tylko środowisko TEST |
| **UPO** | Urzędowe Poświadczenie Odbioru dokumentu z KSeF |
| **Trial** | 14-dniowy okres próbny bez karty |
| **Read-only** | tryb po wygaśnięciu trialu/`past_due`/`suspended`/`canceled`; GET działa, zapisy 403 |
| **Outbox** | trwała tabela zadań do wysłania (mail), przetwarzana przez workera |
| **BullMQ** | kolejka Redis dla KSeF i billing-daily |
| **Presigned URL** | czasowy podpisany URL do S3, ważny 5 min |
| **Tenant guard** | `studioDb` + złożone FK wymuszające `studioId` |
| **RSC** | React Server Components w Next.js App Router |
| **MRR** | miesięczny przychód z aktywnych abonamentów netto; bez trialów i zaległości |
| **P-01 / P-02** | ekrany portalu: status i wygasły link |
| **D-01…D-10 / M-01…M-08** | ekrany desktop/mobile w Figmie |
| **A-01…A-10** | ekrany panelu właściciela platformy (niezaimplementowane) |

---

## 19. Troubleshooting

### Aplikacja nie startuje / brakuje klienta Prisma

```bash
pnpm db:generate
# lub
pnpm dev
```

`lib/db/generated/` jest w `.gitignore`; po klonie trzeba wygenerować klienta.

### `DATABASE_URL is not set` / Prisma nie widzi `.env`

`prisma.config.ts` wczytuje `.env` z katalogu repo tylko wtedy, gdy `DATABASE_URL` nie jest ustawiony w środowisku. Sprawdź, czy plik istnieje (`cp .env.example .env`) i czy komenda jest uruchamiana z katalogu repo. W kontenerze zmienne pochodzą z `env_file` w Compose.

### `P1001` / baza nieosiągalna

Poczekaj na healthcheck Postgresa, sprawdź port (`POSTGRES_PORT`) i host (`postgres` w Compose, `localhost` na hoście). W Dockerze `web` zależy od `postgres: service_healthy`.

### `relation "..." does not exist`

Nie zastosowano migracji:

```bash
pnpm db:deploy
```

Jeśli baza ma rozjechane migracje, sprawdź `prisma migrate status` i dokument naprawy `coating_reminders`.

### Port 3000 / 5432 zajęty

Ustaw w `.env`:

```dotenv
WEB_PORT=3001
POSTGRES_PORT=5433
```

### MinIO: podpisany URL nie działa w przeglądarce

Ustaw `S3_PUBLIC_ENDPOINT=http://localhost:9000`. Podpis obejmuje host; `minio:9000` jest osiągalne tylko z kontenera.

### Bucket nie istnieje / brak uprawnień

Compose ma `minio-init`, który tworzy bucket i ustawia `anonymous none`. Sprawdź logi `minio-init` i zmienne `S3_*`.

### Stripe: 503 „Stripe nie jest skonfigurowany”

Ustaw `STRIPE_SECRET_KEY` i `STRIPE_WEBHOOK_SECRET`; zrestartuj web. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` nie jest wymagany przy hostowanym Checkout.

### Stripe webhook: 400 „Nieprawidłowy podpis”

- użyj `stripe listen --forward-to localhost:3000/api/stripe/webhook`,
- wpisz `whsec_...` z CLI do `STRIPE_WEBHOOK_SECRET`,
- nie parsuj body przed weryfikacją (kod już tego pilnuje),
- sprawdź, czy endpoint w Stripe ma zgodną wersję API `2026-09-30.endive`.

### Checkout: 409 „Okres próbny jeszcze trwa”

To celowe. Checkout jest dostępny po trialu; trial nie wymaga karty. Do testów ustaw `trialEndsAt` w przeszłości lub poczekaj.

### Trial: brak maila przypomnienia

- worker musi działać (`pnpm worker`),
- `SMTP_URL` i `APP_URL` muszą być ustawione,
- sprawdź `trialReminderSentAt` i logi `[billing]`,
- scheduler działa o 06:00 Europe/Warsaw, ale przy starcie robi catch-up.

### KSeF: „only TEST is supported”

`KSEF_ENV` musi być `test`, a `KSEF_API_URL` musi wskazywać `api-test.ksef.mf.gov.pl`. To zabezpieczenie, nie błąd.

### KSeF: „encryption key must be 32 bytes in canonical base64”

Wygeneruj:

```bash
openssl rand -base64 32
```

i ustaw jako `KSEF_TOKEN_ENCRYPTION_KEY` (dokładnie 32 bajty, bez whitespace).

### KSeF: „Studio musi korzystać z KSeF TEST” / brak NIP

Dla ścieżki TEST `Studio.ksefEnv` musi być `test`, a `Studio.nip` ustawiony. Token zapisujesz `PUT /api/studios/:studioId/ksef/token`. PROD wymaga flagi `ksef_prod`, osobnego klucza `KSEF_PROD_TOKEN_ENCRYPTION_KEY` i tokenu zapisanego już po przełączeniu środowiska. Stary token TEST jest wtedy skasowany.

### KSeF: nie ma przycisku „Wyślij”

To znana luka: `queueTestInvoice` nie jest jeszcze podłączone do route/UI. Można je wywołać tylko z kodu/testów.

### Portal: link wygasł / P-02

Token jest ważny 14 dni, może być odwołany, a seedowy wygasły link ma własny token. Sprawdź `expiresAt`/`revokedAt`; nie próbuj zgadywać tokenu.

### Testy: `xmllint` not found

Zainstaluj `libxml2-utils` (Linux) lub użyj systemowego `xmllint` (macOS). Test FA(3) nie pomija braku walidatora.

### Testy: MinIO/Redis pomijane

To zamierzone. Ustaw `S3_TEST_ENDPOINT` / `KSEF_REDIS_TEST_URL`, jeśli chcesz je uruchomić.

### Testy: dziwne dane / konflikty

Testy integracyjne używają wspólnej bazy i resetują studio demo. Używaj osobnej bazy testowej; nie uruchamiaj ich równolegle z dev.

### `pnpm build` bez bazy

Build Next.js nie powinien łączyć się z bazą; Docker ustawia techniczny `DATABASE_URL` i `SKIP_ENV_VALIDATION=1`. W lokalnym buildzie też możesz użyć `SKIP_ENV_VALIDATION=1`, ale runtime musi mieć prawdziwe zmienne.

### `coating_reminders` / `42P07 relation already exists`

To znany przypadek lokalnej historii migracji. Nie usuwaj tabel. Wykonaj procedurę z [`docs/naprawa-migracji-coating-reminders.md`](docs/naprawa-migracji-coating-reminders.md).

---

## Podsumowanie

Detailflow ma już solidny fundament: izolację tenantów, auth, dane demo, kalendarz, klientów, wyceny, faktury z PDF/FA(3), billing Stripe, KSeF TEST i outbox. Największa wartość do domknięcia to **połączenie gotowych modułów domenowych z UI** — przede wszystkim zleceń, kreatora faktury i wysyłki KSeF — oraz **panel platformy**. Ten README jest punktem startowym; szczegóły modułów znajdują się w linkowanych dokumentach.
