# Detailflow — dokumentacja projektu

> **Detailflow** to polski SaaS operacyjny dla studiów detailingowych: kalendarz boksów, zlecenia, klienci i auta, wyceny, faktury KSeF oraz portal klienta. Studio płaci za platformę abonamentem Stripe, a swoje usługi rozlicza fakturą KSeF. To dwa osobne obiegi pieniędzy.

- **Repozytorium:** [JaMkAAaa/detailflow](https://github.com/JaMkAAaa/detailflow)
- **Figma (źródło UI):** [Detailflow](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S)
- **Zakres kodu:** `main` na commicie `704921eb` (po #179). Opis stanu zweryfikowano w kodzie, migracjach i testach tego commitu; późniejsze commity mogą go zmienić.
- **Stack:** Next.js 15 · React 19 · TypeScript · PostgreSQL 16 · Prisma 7 · Tailwind CSS 4 · Better Auth · BullMQ · Stripe · S3/MinIO · KSeF 2.0 (TEST domyślnie, PROD za flagą)

Ten plik jest **opisem stanu kodu** i główną dokumentacją techniczną repozytorium. Opisuje architekturę, wdrożony zakres, reguły biznesowe, dane demonstracyjne, ograniczenia i sposób pracy z kodem. Szczegółowe dokumenty modułów są linkowane w sekcji [Dokumentacja źródłowa](#16-dokumentacja-źródłowa). **Specyfikacją docelową produktu** jest [`docs/dokumentacja-wdrozenia.md`](docs/dokumentacja-wdrozenia.md); przy sprzeczności o stanie wdrożenia wygrywa kod, potem ten plik.

> **Ważne:** repozytorium zawiera działający produkt v1 w fazie twardnienia, a nie makietę: zlecenia, kalendarz, wyceny, portal, faktury z wysyłką do kolejki KSeF, billing Stripe i panel platformy działają na bazie. To **nie jest deklaracja gotowości produkcyjnej ani prawnej**: strony prawne są szkicami, integracja KSeF jest testowana na transporcie zastępczym (bez dowodu z prawdziwym MF w repozytorium), a część elementów pozostaje demonstracją (m.in. terminy w kreatorze wyceny, eksport JPK, podgląd papieru faktury). Dokładny stan opisuje [macierz wdrożenia](#3-status-wdrożenia), a otwarte luki — [sekcja 15](#15-luki-i-plan).

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
16. [Dokumentacja źródłowa](#16-dokumentacja-źródłowa)
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
| Panel platformy (A-01–A-10) | operatorzy Detailflow | SaaS, MRR, wsparcie, audyt | `app/(platform)/admin` (`/admin`), `components/admin`, `src/server/admin` — [§9.15](#915-panel-platformy-admin) |

### 1.4 Role w studiu

| Rola | Dostęp |
| --- | --- |
| `owner` | wszystko, w tym billing, KSeF, faktury, zaproszenia |
| `manager` | operacje, klienci, wyceny, faktury, zaproszenia, katalog usług; bez billingu |
| `worker` | operacje, kalendarz, zlecenia, zdjęcia, klienci; bez faktur, zaproszeń i katalogu usług |

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
- Abonament roczny i płatność klienta online **nie są wdrożone** (flagi `annual_billing` i `client_online_pay` w panelu platformy są wyłączone i niczego nie włączają).
- Limity planów: **egzekwowany jest tylko limit boksów** (Solo 1, Studio 4, Pro bez limitu) przy dodawaniu boksu przez `POST /api/studios/:studioId/bays` (tylko API, bez ekranu; owner); istniejące boksy po obniżeniu planu zostają. Limit użytkowników (1 / 5 / bez limitu) jest tylko pokazywany w karcie studia A-03, nie jest egzekwowany przy zaproszeniach.
- Cennik i obietnice z landingu wymagają zatwierdzenia prawnego przed publikacją.

### 1.7 Poza zakresem v1

- statystyki zaawansowane,
- portfolio,
- pełne Ustawienia i Konto,
- KSeF offline,
- panel właściciela platformy na mobile,
- płatność klienta online za detailing,
- abonament roczny,
- tryb jasny.

Katalog **Usługi i cennik** jest wdrożony (`/services`), a **Magazyn chemii** działa pod `/inventory` (#143). Pozostałe moduły z listy są wybrane i wchodzą pojedynczo — brak jednej pozycji nie oznacza, że cała seria #142–#151 jest ukończona. Płatność klienta za detailing nie jest częścią Stripe Billing. Statystyki i portfolio mogą być widoczne w menu jako **„Wkrótce”**, nigdy jako pusty CRUD albo 404.

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

Panel platformy (`/admin`, osobne logowanie i cookie `df-plat`):

```text
URL:     http://localhost:3000/admin/login
E-mail:  anna.nowak@detailflow.test
Hasło:   platform-demo-2026
```

Operator demo (rola `owner`) nie ma włączonego MFA; zmiany ról i flag w A-08 wymagają najpierw jego włączenia i potwierdzenia kodem TOTP.

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

`pnpm dev` wykonuje `prisma generate` i uruchamia Next.js z `--hostname 0.0.0.0`. `pnpm worker` uruchamia cykl co 15 s (maile: wyceny, decyzje portalu i faktury; odtwarzanie kolejki KSeF; wygaszanie wysłanych wycen; sprzątanie niepotwierdzonych uploadów zdjęć), kolejkę KSeF i scheduler billingu. Do samego UI worker nie jest potrzebny, ale wysyłka maili i KSeF już go wymagają.

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
| `pnpm test` | Vitest, testy jednostkowe i integracyjne (wymagają PostgreSQL po migracjach) |
| `pnpm test:e2e` / `pnpm test:e2e:smoke` | Playwright (Chromium); `smoke` uruchamia testy z tagiem `@smoke` — po `pnpm build`, na osobnej bazie z seedem, z Redisem i `xmllint` ([`e2e/README.md`](e2e/README.md)) |
| `pnpm backup` / `pnpm backup:cron` | jeden `pg_dump` do S3 / powtarzanie o `BACKUP_HOUR_UTC` (serwis Compose `backup`) |
| `pnpm db:generate` | generuje klienta Prisma do `lib/db/generated` |
| `pnpm db:migrate` | `prisma migrate dev` — **tylko lokalnie, tworzy migrację** |
| `pnpm db:deploy` | `prisma migrate deploy` — stosuje istniejące migracje |
| `pnpm db:seed` | seed Obsidian Studio oraz demo platformy (kasuje i odtwarza oba zestawy demo, [§7.4](#74-seed)) |
| `pnpm billing:setup` | tworzy produkty i ceny Stripe (osobno test/live) |

### 2.5 Baza testowa

Testy integracyjne używają prawdziwego PostgreSQL i **kasują/odtwarzają studio demo**. Nigdy nie uruchamiaj ich na bazie produkcyjnej.

```bash
# przykład: osobna baza lokalna po migracjach
DATABASE_URL=postgresql://detailflow:detailflow@localhost:5432/detailflow_test pnpm test
```

---

## 3. Status wdrożenia

Legenda: **Działa** = realne dane z bazy i zapis; **Częściowo** = część przepływu realna, część demo lub bez dowodu na zewnętrznym systemie; **Demo** = wyłącznie UI na danych scenariusza; **Brak** = nie ma implementacji.

Status opisuje **kod**, nie gotowość produkcyjną ani prawną. „Działa” znaczy: ekran czyta i zapisuje dane przez serwer i ma testy w repozytorium. Nie znaczy: sprawdzone z prawdziwym KSeF, prawdziwym Stripe live, zatwierdzone prawnie ani obciążone ruchem.

### 3.1 Ekrany i przepływy

| Obszar | Status | Co działa | Główne ograniczenie |
| --- | --- | --- | --- |
| Landing L-01/L-02/L-03 | **Działa** | responsywny landing, cennik, FAQ, kalkulator (estymacja), CTA `/start`, stopka z linkami do szkiców prawnych | treści marketingowe do zatwierdzenia; „Zobacz demo” to placeholder; podgląd pulpitu to statyczna kopia; brak prawdziwych case studies |
| Strony prawne | **Częściowo** | `/regulamin`, `/polityka-prywatnosci`, `/umowa-powierzenia` renderują szkice z widocznym komunikatem „Projekt do zatwierdzenia prawnego” | **szkice, nie obowiązujące dokumenty**; brak zatwierdzenia prawnego i zgód marketingowych |
| Logowanie | **Działa** | hasło (Argon2id) i magiczny link, reset hasła, wylogowanie, lockout po 5 błędnych hasłach, rate limit auth w Redis | brak MFA studia |
| Rejestracja trialu | **Działa** | `/start`, konto + studio + owner + 14 dni, bez karty | brak weryfikacji e-mail przed wejściem |
| Zaproszenia i zespół | **Działa** | `/team`: zaproszenia, lista członków i zaproszeń, zmiana roli manager/worker, usunięcie członka (zdejmuje jego przypisania do zleceń), `/invite/[token]` | właściciel jest chroniony (nie zmienisz ani nie usuniesz go tą ścieżką); limit użytkowników planu nie jest egzekwowany |
| Przełączanie studiów | **Działa** | cookie `df.active_studio`, picker w sidebarze i na ekranie Więcej (mobile); po zmianie pełne przeładowanie kontekstu | — |
| Ustawienia i KSeF `/settings` | **Działa** | dane sprzedawcy (nazwa, NIP z sumą kontrolną, adres, telefon), przełącznik TEST/PROD, token KSeF — tylko owner, z wpisami w audycie | pełne „Ustawienia i Konto” są poza v1; przycisk „Konto” na ekranie Więcej jest „Wkrótce” |
| Pulpit D-01 / M-01 | **Działa** | KPI, plan boksów, lista dnia, alerty z DB; „Nowe zlecenie” otwiera formularz zlecenia, „Zakończ etap” i „Zdjęcie” (mobile) oraz „Link dla klienta” (desktop) wołają API | brak fallbacku na demo; pracownik nie wystawia faktur (dostaje komunikat o uprawnieniach) |
| Kalendarz D-02 / M-02 | **Działa** | rezerwacje boksów, dzień/tydzień, kolizje, pracownik na zleceniu i filtr osób, „Nowe zlecenie” z wolnego okna | wyszukiwarka w nagłówku mobile jest nieaktywna; boksy dodaje się tylko przez API |
| Klienci D-05 | **Działa** | lista 20/stronę, filtry, karta, wyszukiwanie | brak zdjęcia auta w modelu; „Cała historia” na karcie to „Wkrótce” |
| CRUD klientów/aut | **Działa** | dodawanie, edycja, usuwanie, import CSV/XLSX, eksport i anonimizacja danych klienta (owner/manager, z audytem) | import do 1 MB i 5000 wierszy, pierwszy arkusz XLSX; to narzędzie operacyjne, nie dowód zgodności z RODO |
| Zlecenia D-03 / M-03 | **Działa** | tablica i lista z DB, filtry, tworzenie zlecenia (`POST /orders`), zmiana statusu przez DnD z cofnięciem przy błędzie | filtry po usłudze i tekście; brak wirtualizacji listy |
| Szczegóły zlecenia D-04 / M-04 | **Częściowo** | odczyt z DB, zmiana etapu, zdjęcia (presigned upload do S3), protokół przyjęcia z punktami i akceptacją, historia | przycisk „Link dla klienta” na karcie zlecenia nadal otwiera dialog „Wkrótce” (link powstaje z pulpitu przez API); „⋯” na mobile nieaktywne |
| Backend zleceń | **Działa** | HTTP: tworzenie, odczyt, status, etap; maszyna stanów, historia, numeracja `DF-####`, `canInvoice`, zlecenie z zaakceptowanej wyceny | — |
| Wyceny D-06 / M-05 | **Działa** | kreator, katalog z bazy, zapis szkicu, wysyłka maila z linkiem portalu, lista i karta, zlecenie z zaakceptowanej wyceny, wygaszanie wysłanych wycen w workerze | **terminy w kreatorze są demonstracyjne** i nie rezerwują boksu |
| Usługi i cennik | **Działa** | `/services`: nazwa, cena bazowa brutto Decimal PLN, czas, aktywna/ukryta; menu desktop i Więcej; pusty stan | owner/manager; worker nie widzi menu; ukryte usługi nie wchodzą do nowych wycen i zleceń |
| Portal P-01/P-02 | **Działa** | tokeny, decyzja o wycenie, status zlecenia z bazy (3 etapy), zdjęcia zlecenia i akceptacja protokołu, P-02 dla złego/wygasłego/odwołanego linku, mail do właścicieli | `app/p/quote-preview` to placeholder; link samej wyceny nie pokazuje zdjęć ani protokołu |
| Faktury D-07/D-10 | **Działa** | lista, filtry, wyszukiwanie, „wymagają uwagi”, płatność, korekta, ponowienie wysyłki KSeF i poprawa NIP odrzuconej faktury | lista pobiera wszystkie faktury środowiska i paginuje po 7 w UI; „Eksport JPK” pokazuje tylko komunikat, offline jest wyłączony |
| Kreator faktury D-08 | **Działa** | kroki, walidacja, podgląd, autosave, `POST /invoices` ze zlecenia `completed`, obsługa 400/409 | wystawienie nie kolejkuje KSeF ani nie wysyła maila (to osobne akcje na szczegółach) |
| Szczegóły faktury D-09/M-08 | **Działa** | dane, PDF, XML FA(3) także dla korekt, płatność, korekta, „Wyślij do KSeF”, „Wyślij ponownie” (PDF przez outbox), UPO z DB | podgląd „papieru” w UI jest oznaczony jako demonstracyjny (w tym ilustracyjny QR); UPO istnieje tylko po odpowiedzi MF (seed go nie ma) |
| KSeF TEST/PROD | **Częściowo** | klient API, szyfrowanie tokenu per środowisko, kolejka i worker, retry, historia, UPO; wysyłka z UI do kolejki; PROD za flagą `ksef_prod` | brak dowodu z prawdziwym MF w repozytorium (testy używają transportu zastępczego); E2E kończy się na kolejce; seed tylko udaje dokumenty i UPO; brak offline |
| Stripe Billing | **Działa** | plany, Checkout, webhooki, portal, trial, read-only, MRR i wpływy w panelu platformy | wymaga konfiguracji kluczy; testy i E2E używają atrapy Stripe — brak dowodu z kontem live w repozytorium |
| Zdjęcia i protokół | **Działa** | presigned upload, S3, protokół, akceptacja w studiu i w portalu, sprzątanie niepotwierdzonych uploadów (24 h) | potwierdzone zdjęcia nie mają automatycznej retencji |
| Panel platformy A-01–A-10 | **Działa / Częściowo** | `/admin` na agregatach z bazy, MFA TOTP, sesja wsparcia 15 min, audyt — szczegóły w [§3.3](#33-panel-platformy-a-01a-10) i [§9.15](#915-panel-platformy-admin) | A-06, A-08 i A-09 mają udokumentowane ograniczenia |
| Magazyn chemii `/inventory` | **Działa** | stany per studio, pełne sztuki/ml, próg i jawna korekta z powodem oraz kontrolą wersji; rzeczywisty alert na pulpicie desktop/mobile | bez automatycznego zużycia przy zleceniu; odczyt dla zespołu, zapis owner/manager z kontrolą abonamentu |
| Statystyki/portfolio | **Brak** | menu „Wkrótce” | osobne issue |
| Wyszukiwarka ⌘K | **Działa** | Cmd/Ctrl+K i przyciski w topbarze oraz „Więcej”; wyniki aktywnego studia dla klientów, aut, zleceń i faktur | pracownicy nie widzą faktur; do 4 wyników na kategorię |
| E-mail transakcyjny | **Częściowo** | auth, zaproszenia, wycena, decyzja, trial, faktura z PDF (outbox) | brak SMS; bez `SMTP_URL` w produkcji wysyłka czeka w outboxie; dostarczenie SMTP jest „co najmniej raz” |
| Obserwacja i kopie | **Częściowo** | `/api/health` (DB i Redis), logi pino JSON, Sentry web + worker (po ustawieniu DSN), backup `pg_dump` do S3 z retencją | brak metryk i gotowych alertów; backup nie ma szyfrowania na poziomie aplikacji ani zautomatyzowanego testu odtworzenia ([§14.5](#145-backup-i-odtwarzanie)) |
| Testy automatyczne | **Działa** | Vitest (jednostkowe i na Postgresie), Playwright `@smoke` w CI na PR, w tym ścieżka zlecenie → faktura → kolejka KSeF | brak progu coverage i testów obciążeniowych ([§13](#13-testowanie-i-jakość)) |

### 3.2 Co to oznacza przy testach ręcznych

- **Dane demo są prawdziwe w bazie** dla pulpitu, kalendarza, klientów, zleceń, wycen, faktur, portalu i panelu platformy. Ekrany operacyjne nie mają fallbacku na dane demo; wyjątki to terminy w kreatorze wyceny i statyczny podgląd pulpitu na landingu.
- **Możesz** zakończyć etap, zmienić status, dodać zdjęcie i protokół z karty zlecenia, utworzyć zlecenie z formularza, wystawić fakturę kreatorem i zakolejkować ją do KSeF TEST przyciskiem na szczegółach faktury.
- **Nie oczekuj** pełnej wysyłki do MF bez uruchomionego workera, `KSEF_TOKEN_ENCRYPTION_KEY`, NIP i tokenu studia. Seedowe faktury FV/41 mają numer KSeF i historię, ale nie mają `KsefSubmission` ani UPO.
- **Nie oczekuj** działającego eksportu JPK, trybu offline KSeF, linku portalu z przycisku na karcie zlecenia ani rezerwacji boksu z terminów kreatora wyceny.
- Wystawienie faktury z `#DF-0248` jest odrzucane (zlecenie nie jest `completed`); seedowa FV/41 pochodzi z `#DF-0243`.
- Panel platformy: `/admin/login` (operator demo z [§2.2](#22-wariant-docker-zalecany)). Zmiany ról i flag wymagają włączonego MFA operatora.

### 3.3 Panel platformy (A-01–A-10)

Wszystkie loadery `/admin` czytają `platformDb`; w kodzie ekranów nie ma fixture ani mocków (komponenty dostają dane z `src/server/admin/*`). Liczby z makiety (192 studia, MRR 16 672 zł, wpływy 14 980 zł) powstają dopiero po `pnpm db:seed`, który wstawia kohortę `df-demo-*`, płatności i koszty demo — bez seeda panel pokazuje wyłącznie to, co faktycznie zapisano w bazie. Testy: `src/server/admin/*.test.ts` (Postgres), `components/admin/*.test.tsx`, `prisma/seed.test.ts`, `e2e/billing.spec.ts`.

| Ekran | Trasa | Status | Źródło danych i zakres |
| --- | --- | --- | --- |
| A-01 Przegląd | `/admin` | **Działa** | `getPlatformOverview`: MRR przez `calculateMrr` (tylko `active`), triale, zaległości, odrzucone faktury KSeF, aktywność studiów, aktywacja. Nie liczy „aktywnych użytkowników” z makiety (294/382) — tylko aktywność studiów |
| A-02 Lista studiów | `/admin/studios` | **Działa** | `listStudios`: wyszukiwanie, filtry, 20/stronę, eksport CSV (`/admin/studios/export`); `canceled` trafia do filtra „Wstrzymane” |
| A-03 Karta studia | `/admin/studios/[publicCode]` | **Działa** | `getStudioCard`: kontakt, liczba członków i boksów, limity planu (informacyjne), ostatnie 30 zdarzeń audytu. Każde otwarcie karty zapisuje `platform.studio.view` |
| A-04 Abonamenty | `/admin/subscriptions` | **Działa** | skład MRR z `Studio`, wpływy z `SubscriptionPayment` (zapis z webhooka Stripe `invoice.paid`, netto PLN), zaległości, churn, koszty z `PlatformCost` (ręczny formularz, niedostępny dla roli `support`) |
| A-05 Analityka | `/admin/analytics` | **Działa** | aktywacja, konwersja triala, retencja kohortowa, wykorzystanie funkcji z tabel operacyjnych; „Faktury PROD” liczy tylko `ksefEnv=production` |
| A-06 System i KSeF | `/admin/system` | **Częściowo** | PostgreSQL (`SELECT 1`) i Redis (`PING`, 800 ms) sprawdzane na żywo; Stripe i poczta tylko jako „skonfigurowane” (bez wywołania API); KSeF TEST/PROD z faktur i zdarzeń w bazie, incydent gdy kolejka stoi > 15 min. Nie mierzy opóźnień ani dostępności MF |
| A-07 Wsparcie | `/admin/support` | **Działa** | kolejka zgłoszeń (do 80), SLA 8 h / 1 h (pilne), otwarcie, odpowiedź i zamknięcie przez operatora. Studio nie ma własnego formularza zgłoszeń, a odpowiedź nie jest wysyłana mailem — zapisuje się w bazie |
| A-08 Administracja | `/admin/operators` | **Częściowo** | role operatorów (zmienia tylko `owner`), flagi (`owner`/`admin`), MFA, 40 ostatnich wpisów audytu. Brak zaproszeń i tworzenia operatorów — konta operatorów powstają poza UI (seed/baza) |
| A-09 Sesja wsparcia | karta studia | **Częściowo** | okno 15 min z powodem i zgłoszeniem, wpis `SupportSession` i audyt `support.session.started`; nie tworzy sesji studia i nie otwiera panelu studia (brak podglądu danych studia w trybie „tylko do odczytu”, brak ręcznego zakończenia — wygasa albo zastępuje ją nowa) |
| A-10 Zawieszenie konta | karta studia | **Działa** | potwierdzenie nazwy i powód, `Studio.status = suspended`, audyt `studio.suspended`, odcięcie sesji użytkowników bez innego niezawieszonego studia; nie anuluje subskrypcji Stripe |

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
        └──▶ KSeF API (TEST; PROD za flagą) ◀── worker
```

### 4.2 Monolit modularny

To **jeden deploy Next.js** plus **jeden worker** z tego samego obrazu. Nie ma osobnego API, GraphQL, Nesta ani Kafki. Granice modułów są w katalogach:

- `app/` — routing, strony, route handlery, server actions,
- `components/` — UI i logika prezentacji,
- `src/server/` — logika domenowa i operacje na bazie,
- `src/domain/` — czyste funkcje domenowe (cena, katalog),
- `src/ksef/` — adapter KSeF (TEST i PROD), XML FA(3), kolejka,
- `src/invoices/` — PDF i walidacja dokumentu,
- `src/server/admin/` — logika panelu platformy (MFA, sesja wsparcia, audyt, metryki),
- `src/observability/`, `src/backup/` — logi, Sentry, health, backup Postgres,
- `lib/` — auth (studio i platforma), db, env, storage, tokeny portalu,
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
- Operatorzy platformy logują się osobną instancją Better Auth (`lib/auth/platform.ts`, ścieżka `/api/auth/platform`, cookie `df-plat`) na tych samych tabelach `User`/`Account`; sesja powstaje tylko dla konta z wpisem `PlatformOperator`, a członkostwo studia nie otwiera `/admin`.
- Lockout logowania (studio i platforma osobno): 5 błędnych prób w 15 min blokuje ten e-mail na 15 min; w tabeli `AuthLockout` jest hash, nie adres.
- Rate limit auth: 100 żądań/min, logowanie i magic link 5/min, reset 3–5/min; atomowe liczniki w Redis, osobne dla studia i panelu platformy. Zapis API studia: 60/min na użytkownika, wspólnie dla jego studiów; odczyty i publiczny portal nie zużywają limitu zapisów. Przekroczenie daje ogólne 429, API z `Retry-After`. Awaria Redisa blokuje auth (429) i zapisy API (503), bez awaryjnego limitu w pamięci. `REDIS_URL` jest wymagane przez walidację środowiska.

### 4.6 Tło i kolejki

| Mechanizm | Nośnik | Uruchamiane przez | Przeznaczenie |
| --- | --- | --- | --- |
| Outbox maili | PostgreSQL | `setInterval` 15 s w workerze | wyceny, decyzje portalu, faktury z PDF (`InvoiceMail`) |
| Sweepy w cyklu 15 s | PostgreSQL / S3 | ten sam `setInterval` | odtworzenie kolejki KSeF po awarii Redisa, wygaszanie wysłanych wycen (`expired`), usuwanie niepotwierdzonych uploadów starszych niż 24 h |
| `ksef-test` | BullMQ + Redis | worker | wysyłka i poll KSeF (faktury TEST oraz PROD, gdy flaga `ksef_prod` jest włączona) |
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
  (marketing)/            landing publiczny oraz szkice stron prawnych
                          (landing, regulamin, polityka-prywatnosci, umowa-powierzenia)
  (platform)/admin/       panel platformy A-01–A-10 (login, logout, (console)/…)
  (studio)/               panel studia (sidebar/topbar/tabbar)
  p/[token]/              portal klienta bez sesji (+ decision, protocol, media)
  api/                    route handlery (auth, auth/platform, health, Stripe, studio API)
components/
  admin/ auth/ brand/ faktury/ kalendarz/ klienci/ ksef/ landing/ portal/
  pulpit/ states/ studio/ ui/ wyceny/ zlecenia/
lib/
  auth.ts, auth/ (w tym platform.ts), db/, portal/, landing/, env.ts, storage.ts, utils.ts
src/
  backup/                 pg_dump do S3, retencja, cron
  domain/                 czysta domena (cena, katalog, terminy)
  invoices/               PDF i walidacja dokumentu
  ksef/                   klient KSeF, FA(3), XSD, szyfrowanie, kolejka, flaga PROD
  observability/          logger pino, Sentry, health, scrubbing danych
  server/                 ACL, HTTP, moduły operacyjne, billing
    admin/                logika panelu platformy (MFA, sesja wsparcia, metryki)
    rate-limit/ search/ security/  limity w Redis, wyszukiwarka ⌘K, CSP
  worker/                 workery BullMQ
worker/index.ts           punkt wejścia procesu tła
e2e/                      Playwright (smoke) — osobna baza, Redis, bez workera KSeF
scripts/                  pg-backup.ts (backup jednorazowy i cron)
prisma/
  schema.prisma           model danych
  migrations/             18 migracji
  seed.ts, seed-platform.ts  Obsidian Studio + demo platformy
audit/admin/              definicje metryk i projekt UX panelu platformy (Figma)
docs/                     specyfikacja produktu i naprawa migracji
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
| `worker/index.ts` | start workera, outboxa i sweepów |
| `src/server/admin/` | panel platformy: `mfa.ts`, `studio-access.ts`, `operators.ts`, `metrics.ts` |
| `lib/auth/platform.ts` | osobna instancja Better Auth dla operatorów (`df-plat`) |
| `src/ksef/submissions.ts`, `src/ksef/flag.ts` | kolejkowanie, retry, flaga `ksef_prod` |
| `src/server/faktury/mail.ts` | outbox maila faktury z PDF |
| `src/server/rate-limit/index.ts` | współdzielone liczniki Redis (auth i zapisy API) |
| `.github/workflows/ci.yml` | CI: `check`, `db`, `docker`, `e2e` |

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
| `KSEF_ENV` | musi być `test`; inna wartość rzuca błąd. To nie jest przełącznik studia ani środowiska PROD |
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
| `RESEND_API_KEY` | zarezerwowane; aplikacja **nie wysyła** przez Resend. Panel A-06 uznaje ją jednak za ślad konfiguracji poczty (zielone „Poczta” bez `SMTP_URL` nie oznacza działającej wysyłki) |
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
| `BACKUP_HOUR_UTC` | godzina (0–23, UTC) dziennego backupu w `backup:cron`; domyślnie 3 |
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
- Migracje leżą w `prisma/migrations/`; jest ich **18**.
- `prisma.config.ts` wskazuje seed `tsx prisma/seed.ts`.
- Wygenerowany klient Prisma (`lib/db/generated/`) jest w `.gitignore`; trzeba go wygenerować (`pnpm db:generate`, `pnpm dev`, `pnpm build`).

### 7.2 Komendy

```bash
# lokalny dev: nowa migracja po zmianie schema.prisma
pnpm db:migrate

# wdrożenie istniejących migracji (dev/prod/CI)
pnpm db:deploy

# reset danych demo (kasuje i odtwarza Obsidian Studio oraz demo platformy)
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
| `20261027240000_platform_operator` | `PlatformOperator`, rola platformy, `Studio.activatedAt` |
| `20261028120000_platform_subscriptions` | `SubscriptionPayment`, `PlatformCost` |
| `20261028140000_platform_ops` | `FeatureFlag`, zgłoszenia i sesje wsparcia, MFA operatora, indeks `AuditLog` |
| `20261028160000_auth_lockout` | `AuthLockout` (lockout logowania) |
| `20261029035000_invoice_mail` | `InvoiceMail` (outbox maila faktury) |
| `20261029063430_work_order_assignee` | `WorkOrder.assigneeId` (pracownik na zleceniu) |

### 7.4 Seed

`prisma/seed.ts` odtwarza **Obsidian Studio 1:1 z makiety**, a `prisma/seed-platform.ts` dokłada demo platformy:

- studio `active`, plan `studio`, `ksefEnv=test`, Warszawa Mokotów (`ST-00128`),
- właściciel Michał Kowalski (`michal.kowalski@example.com` / `obsidian-demo-2026`); to jedyny członek studia, więc nikt nie ma przypisanych zleceń,
- 124 klientów, 168 aut, 2 boksy,
- 7 aktywnych zleceń (3 w trakcie, 2 do odbioru, 2 przyjęte) + 12 zakończonych,
- wycena Porsche #DF-0248: 4 000 zł × 1,20 × 1,00 = 4 800 zł, VAT 897,56 zł,
- 8 faktur TEST, w tym FV/41/10/2026 z **#DF-0243** (nie z #DF-0248),
- 3 przypomnienia o powłoce ceramicznej,
- 2 linki portalu: ważny i wygasły,
- demo platformy: operator `anna.nowak@detailflow.test` (rola `owner`, bez MFA), 191 studiów `df-demo-*` (razem 192 z Obsidian: 128 aktywnych, 24 triale, 6 `past_due`, 8 wstrzymanych, 26 anulowanych), zlecenia do metryk aktywacji, `SubscriptionPayment` z października (14 980 zł netto), `PlatformCost` (1 860 + 1 300 + 1 100 zł), flagi `ksef_prod`, `annual_billing`, `client_online_pay` (wszystkie wyłączone) i 2 zgłoszenia wsparcia (`TK-00041`, `TK-00042`).

Seed jest **destrukcyjny tylko dla zestawów demo**: usuwa i odtwarza studio `obsidian-studio` oraz kohortę `df-demo-*` (a także relikty `platform-demo-*` ze starszego seeda); kaskada usuwa ich dane. Inne studia zostają. Użytkownicy właściciela i operatora są `upsert`owani. Seed jest idempotentny — CI uruchamia go dwa razy.

Seed nie tworzy `KsefSubmission`, więc UPO dla FV/41 nie istnieje; numer KSeF i historia są danymi demonstracyjnymi. Seed nie tworzy zdjęć ani protokołu przyjęcia. Seed **nie wysyła nic do MF** ani do Stripe — identyfikatory `cus_seed_…`/`sub_seed_…` i wpływy platformy są fikcyjne.

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
| `Studio` | `publicCode`, `name`, `slug`, dane sprzedawcy (`ownerLegalName`, `nip`, adres), `status`, `plan`, `trialEndsAt`, `activatedAt`, `stripeCustomerId`, `stripeSubscriptionId`, `ksefEnv`, `ksefTokenEnc` | tenant i stan billingu |
| `User` | `email`, `name`, `emailVerified` | konto osoby |
| `Session` | `token`, `expiresAt`, `userId` | sesja Better Auth |
| `Account` | `providerId`, `accountId`, `password` | hasło Argon2id / provider |
| `Verification` | `identifier`, `value`, `expiresAt` | magic link / reset |
| `StripeEvent` | `id` (`evt_...`), `type`, `processedAt` | idempotencja webhooków |
| `AuthLockout` | `subjectHash`, `failures`, `windowStart`, `lockedUntil` | lockout logowania (hash `realm:e-mail`) |
| `AuditLog` | `actorId`, `studioId`, `action`, `meta`, `createdAt` | audyt wybranych operacji: billing (webhook Stripe), profil i token KSeF studia, zmiana środowiska KSeF, zespół (`studio.member.*`), eksport/anonimizacja klienta (`client.privacy.*`) oraz działania operatorów platformy (`platform.*`, `support.*`, `studio.suspended`). Nie obejmuje zleceń, wycen ani faktur |
| `PlatformOperator` | `userId`, `role` (`owner`, `support`, `admin`) | operator panelu `/admin` |
| `OperatorMfa`, `OperatorMfaBackup`, `PlatformMfaStepUp` | `secretEnc`, `enabledAt`, `lastAcceptedStep`; `codeHash`, `usedAt`; `sessionId`, `expiresAt` | MFA TOTP operatora, kody zapasowe, podniesienie uprawnień do 12 h |
| `FeatureFlag` | `key`, `label`, `enabled`, `updatedById` | flagi platformy (`ksef_prod`, `annual_billing`, `client_online_pay`) |
| `SupportTicket`, `SupportMessage`, `SupportSession` | `publicCode`, `status`, `priority`, `slaDueAt`; `fromStudio`, `body`; `reason`, `expiresAt`, `endedAt` | wsparcie w A-07 i A-09 |
| `SubscriptionPayment`, `PlatformCost` | `stripeInvoiceId`, `amountNet`, `paidAt`; `year`, `month`, `category`, `amountNet` | wpływy abonamentowe (z webhooka Stripe) i koszty działania w A-04 |

### 8.3 Modele operacyjne

| Model | Najważniejsze pola | Rola |
| --- | --- | --- |
| `Membership` | `studioId`, `userId`, `role` | rola w studiu |
| `Invitation` | `email`, `role`, `tokenHash`, `expiresAt`, `acceptedAt` | zaproszenie jednorazowe |
| `Client` | `name`, `email`, `phone`, adres, `nip`, `isRegular` | klient studia |
| `Vehicle` | `clientId`, `make`, `model`, `plate`, `size` | auto klienta |
| `Bay` | `name`, `sort` | boks |
| `Service` | `code`, `name`, `basePrice`, `durationMin`, `sort` | katalog wyceny |
| `WorkOrder` | `number`, `clientId`, `vehicleId`, `bayId`, `assigneeId`, `quoteId`, `status`, `stage`, `scheduledFrom/To`, `dueAt`, `completedAt`, `totalGross` | zlecenie |
| `OrderCounter` | `studioId`, `last` | atomowa numeracja `DF-####` |
| `WorkOrderEvent` | `fromStatus`, `toStatus`, `fromStage`, `toStage`, `actorId` | historia zlecenia |
| `OrderPhoto` | `workOrderId`, `no`, `stage`, `key`, `contentType`, `sizeBytes`, `uploadedAt` | zdjęcie w S3 |
| `IntakeProtocol` | `workOrderId`, `number`, `acceptedAt` | protokół przyjęcia |
| `IntakeDamage` | `protocolId`, `no`, `title`, `part`, `posX`, `posY`, `photoId` | punkt uszkodzenia |
| `CoatingReminder` | `vehicleId`, `dueAt`, `completedAt` | jawny termin konserwacji |
| `Quote` | `clientId`, `vehicleId`, `status`, `sizeMult`, `paintMult`, `totalGross`, `vatAmount`, `sentAt`, `decidedAt`, `revision`, `wizardStep` | wycena |
| `QuoteItem` | `quoteId`, `name`, `basePrice`, `durationMin`, `sort` | snapshot pozycji |
| `QuoteSendMail` | `quoteId`, `sentAt` | trwały outbox wysyłki wyceny |
| `InvoiceMail` | `invoiceId`, `recipient`, `sentAt`, `attempts`, `nextAttemptAt` | trwały outbox maila faktury z PDF |
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
| `PlatformRole` | `owner`, `support`, `admin` |
| `SupportTicketStatus` | `open`, `waiting`, `resolved` |
| `SupportPriority` | `normal`, `urgent` |
| `PlatformCostCategory` | `infrastructure`, `messaging`, `support` |
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
| `studio:settings` | owner (dane sprzedawcy, token i środowisko KSeF, dodawanie boksów) |
| `studio:select` | owner, manager, worker |
| `studio:read` | owner, manager, worker |
| `orders:write` | owner, manager, worker |
| `orders:update` | owner, manager, worker |
| `clients:privacy` | owner, manager |
| `quotes:write` | owner, manager |
| `invoices:manage` | owner, manager |
| `members:invite` | owner, manager (także lista członków, zmiana roli i usunięcie; właściciela nie da się zmienić ani usunąć tą ścieżką) |

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

„Na warsztacie”: pierwsze `in_progress` w boksie, którego przedział przecina dzisiejszy dzień. Plan dnia pokazuje 08:00–16:00. Akcje są podłączone do API: „+ Nowe zlecenie” (pulpit i mobilny „+”) otwiera `/orders?new=1` z tym samym formularzem co tablica; „Zakończ etap” i „Zdjęcie” (mobile) wołają `POST …/advance` i upload zdjęcia; „Link dla klienta” (desktop) tworzy link przez `POST …/portal-links` i pokazuje go tylko do zamknięcia dialogu. „Wystaw fakturę” otwiera kreator (pracownik dostaje komunikat o uprawnieniach). Dzwonek mobilny pokazuje alerty ceramiki i KSeF z tych samych danych co pulpit.

### 9.4 Kalendarz i rezerwacje

**Implementacja:** `app/(studio)/calendar/page.tsx`, `src/server/kalendarz/booking.ts`, `components/kalendarz/`.

- Rezerwacja to `bayId` + `scheduledFrom` + `scheduledTo` na istniejącym `WorkOrder`; **nie ma osobnej tabeli rezerwacji**.
- Daty lokalne (`2026-10-27T10:00`) oznaczają czas ścienny Warszawy; ISO z offsetem/Z oznacza konkretną chwilę. Baza trzyma UTC.
- Nieistniejąca godzina w zmianie czasu i niejednoznaczna godzina lokalna są odrzucane (400); w drugim przypadku trzeba podać offset.
- Przedziały są **półotwarte** `[od, do)`: 10–12 i 12–14 są dozwolone.
- Kolizja w tym samym boksie → 409; inny boks → OK. Anulowane zlecenia nie blokują.
- Zakończone zlecenia zachowują historię zajętości, ale nie można ich rezerwować ponownie ani przesuwać.
- Zapis i sprawdzenie kolizji są w jednej transakcji Serializable z ograniczonym ponowieniem (Prisma P2034 / `TransactionWriteConflict`).
- Boks dodaje się tylko przez `POST /api/studios/:studioId/bays` (owner) i podlega limitowi planu ([§1.6](#16-plany-i-trial)); UI do zarządzania boksami nie ma.
- `POST` przypisuje boks do zlecenia bez rezerwacji; `PUT` zmienia; `DELETE` zwalnia boks, zachowując zlecenie i daty.
- UI: widok dnia i tygodnia, pasek tygodnia na mobile, wolne okna ≥ 60 min, formularz rezerwacji. Filtr osób: „Wszystkie osoby”, „Nieprzypisane” i członkowie studia (`WorkOrder.assigneeId` → `Membership`). Wolne okno otwiera „Nowe zlecenie” z boksem i godzinami (`POST /orders` z `bayId`); 409 zostaje w formularzu.

### 9.5 Klienci i auta

**Implementacja:** `app/(studio)/customers/`, `src/server/klienci/`, `components/klienci/`.

- Lista D-05: 20 wierszy na stronę **w SQL** (`take`/`skip`), nie w przeglądarce.
- Filtry: wszyscy / stali klienci / serwis powłoki; wyszukiwanie po nazwie, telefonie, rejestracji, marce i modelu.
- Telefon jest normalizowany do wariantów (`600123`, `+48600123456`, `600 123`); rejestracja do wariantów `WA 911PC` / `wa911`.
- Karta klienta: auta, ostatnie wizyty, aktywne zlecenie, suma brutto, informacja o powłoce; „Cała historia” jest jeszcze „Wkrótce”. Owner/manager eksportuje JSON albo anonimizuje/usuwa dane klienta ([§12.3](#123-rodo--praktyczne-uwagi)).
- CRUD: klient, auto, zmiana właściciela auta w tym samym studiu.
- **Duplikat tablicy nie jest błędem**: zapis przechodzi, odpowiedź zawiera `warnings: [{ code: "duplicate_plate", ... }]`. Powód: historyczne dane z Excela i sprzedaż auta.
- Usunięcie klienta/auta z historią zleceń lub wycen → **409**.
- Import CSV/XLSX: maks. 1 MB i 5000 wierszy; CSV obsługuje separator `,`/`;`/tab i BOM; oba formaty używają tych samych aliasów nagłówków PL/EN i wymagają imienia, marki, modelu oraz tablicy. XLSX czyta pierwszy arkusz. Dopasowanie klienta po e-mailu, potem telefonie, tylko w tym studiu; ten sam klient + ta sama tablica = `unchanged`; duplikat tablicy zwraca ostrzeżenie.
- Strona `/customers` używa `directory.ts` (sortowanie od najdłużej współpracujących, nacisk na demo D-05); API `GET /clients` używa `clients.ts` (sortowanie po nazwie, 20/stronę). To dwie świadome ścieżki odczytu.

### 9.6 Zlecenia i maszyna stanów

**Implementacja:** `src/server/zlecenia/state.ts`, `src/server/zlecenia/README.md`.

Logika i HTTP są przetestowane, a ekrany D-03/D-04/M-03/M-04 są podłączone do bazy: lista i szczegóły czytają zlecenia przez `studioDb`, tworzenie idzie przez `POST /orders`, status przez `POST …/status` (DnD na tablicy z cofnięciem karty przy błędzie), a „Zakończ: etap” przez `POST …/advance`. Route handlery wywołują `transitionOrder`/`advanceStage`. `components/zlecenia/board-demo.ts` zawiera już tylko typy, kolumny i filtry współdzielone przez UI; `demo.ts` i `board-fixture.ts` są danymi wyłącznie dla testów komponentów.

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

**HTTP** (`/api/studios/:studioId/orders`): `GET` zwraca listę, `POST` tworzy zlecenie (`clientId`, `vehicleId`, `service`, `totalGross` jako tekst dziesiętny, `scheduledFrom`, `scheduledTo`; opcjonalnie `bayId` — wtedy to rezerwacja boksu z kontrolą kolizji (409) — oraz `assigneeId`, członek tego studia albo `null`). Daty bez offsetu oznaczają Warszawę; luki i powtórzenia DST wymagają offsetu, jak w kalendarzu. Numer, status `accepted`, etap 1 i zdarzenie utworzenia zapisują się atomowo. Auto musi należeć do wskazanego klienta.

`GET /:id` przyjmuje id albo `DF-####`. `POST /:id/status` przyjmuje `{ "status": "in_progress" }`; `POST /:id/advance` przesuwa etap bez body. Zapis wymaga Origin, wszystkie endpointy wymagają sesji i roli owner/manager/worker (`orders:write` dla odczytu/tworzenia, `orders:update` dla statusu/etapu). Cudze studio/rekord → 404, blokada zapisu przez billing → 403, nielegalny ruch lub konflikt → 409. Na karcie zlecenia przycisk „Link dla klienta” jest nadal dialogiem „Wkrótce” (API `portal-links` jest podłączone z pulpitu).

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
- Katalog usług jest w tabeli `Service` (`/services`, owner/manager). Cena bazowa to Decimal PLN. Ukryta usługa nie pojawia się przy nowym wyborze w wycenie ani zleceniu. `QuoteItem` trzyma snapshot nazwy, ceny i czasu bez klucza obcego, więc zmiana i usunięcie usługi nie przepisują historycznych wycen. Cztery usługi D-06 powstają w seedzie demo, nie przy każdym wejściu do wycen albo zleceń — pusta lista zostaje pusta. Kreator nadal może poprawić aktywną usługę; ten zapis dotyczy katalogu, nie wysłanych wycen.
- Lista `/quotes` i karta `/quotes/:quoteId` są dostępne dla owner/manager. Zaakceptowana wycena otwiera istniejący formularz zlecenia z klientem, autem, nazwami usług i kwotą snapshotu. Termin i boks wybiera studio.
- `POST /api/studios/:studioId/quotes/:quoteId/order` wymaga owner/manager, Origin i prawa zapisu w billingu. Serwer kopiuje kwotę Decimal i dane z zaakceptowanej wyceny; nie ufa tym polom z formularza. Unikalność `(quoteId, studioId)` i transakcja chronią także równoległe kliknięcia; retry zwraca istniejące zlecenie.
- Terminy w kreatorze (`quoteSlots`) są **demonstracyjne** — nie rezerwują boksu i nie są częścią maila.
- Wygasanie: ten sam cykl workera (15 s) ustawia `expired` dla wysłanych wycen bez decyzji po 14 dniach od ostatniego `sentAt` albo po utracie wszystkich ważnych linków (wyceny i powiązanego zlecenia) — co nastąpi wcześniej. Oczekująca pierwsza wysyłka (`sentAt: null`) nie wygasa. Decyzja jest możliwa tylko dla statusu `sent`, więc wygasła wycena nie może zostać zaakceptowana. Przypomnienia o wygasaniu nie ma.

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
- P-01 (status zlecenia) czyta zlecenie, auto i klienta z bazy przez `studioDb`: numer, usługa, kwota brutto, kontakt studia, data odbioru (`dueAt` albo `scheduledTo`) i **3 etapy portalu** (etapy studia 1/2/3/4 → portal 1/2/3/3; anulowane ma jawny status). Ekran nie importuje danych demo, także dla seedowego tokenu.
- Link zlecenia pokazuje zdjęcia tego zlecenia (tylko potwierdzone) przez `GET /p/media/:photoId` z osobnym podpisem HMAC (nie surowy token) oraz — gdy protokół istnieje — jego akceptację przez `POST /p/:token/protocol` (ta sama flaga `acceptedAt` co API studia; zły/wygasły/odwołany token → P-02). Link samej wyceny zachowuje formularz decyzji i **nie** pokazuje zdjęć ani protokołu, także gdy z wyceny powstało zlecenie.
- Link do zlecenia tworzy studio przez `POST /api/studios/:studioId/portal-links` (obecnie z pulpitu; przycisk na karcie zlecenia jest „Wkrótce”).
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
- „Ponów wysyłkę” i „Popraw NIP i wyślij ponownie” wołają `POST …/ksef/retry` (tylko `rejected`/`retrying`, bez numeru KSeF; NIP można zmienić po potwierdzonym odrzuceniu — patrz [§9.10](#910-ksef-20-test-i-prod-za-flagą)). „Eksport JPK” pokazuje tylko komunikat o niedostępności, a „Offline” jest wyłączony (poza v1).

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

**Kreator D-08 wystawia fakturę** przez `POST /api/studios/:studioId/invoices`: ładuje zakończone zlecenia, pozwala sprawdzić nabywcę i pozycje, pokazuje błędy 400/409 oraz otwiera nowy dokument po zapisie. Środowisko wybiera serwer; przycisk jest blokowany podczas zapisu. Rabat jest wliczany w cenę netto zaokrągloną do grosza, a API sprawdza zgodność brutto ze zleceniem. Wystawienie nie kolejkuje KSeF ani nie wysyła maila — to osobne akcje na szczegółach faktury.

#### Szczegóły, PDF i XML

- `GET /api/studios/:studioId/invoices/:invoiceId/:format?env=test|production` (owner/manager).
- `env` jest obowiązkowy; brak/zły → 400. `format` to `pdf` albo `xml`.
- Odpowiedzi są załącznikami z `Cache-Control: private, no-store` i `X-Content-Type-Options: nosniff`.
- PDF: `@react-pdf/renderer`, A4, lokalny Inter z polskimi znakami; dane z zapisanego snapshotu, nie przeliczane z brutto.
- XML: FA(3), namespace `http://crd.gov.pl/wzor/2025/06/25/13775/`, wariant 3, PLN, krajowy VAT 23/8/5/0, nabywca NIP albo `BrakID`, korekty `KOR`. Zwolnienia i transakcje zagraniczne wymagają osobnego mapowania. Walidacja XSD (`xmllint --nonet`, schematy w `src/ksef/xsd/`) jest obowiązkowa przed kolejką KSeF.
- Walidacja dokumentu odrzuca szkice, niezakończone zlecenia, ułamki grosza, niezgodne sumy i brutto różne od zlecenia (409).
- Eksport **nie ustawia `emailedAt`**; pobranie to nie wysyłka.
- PDF nie zawiera demonstracyjnego QR jako kodu weryfikacyjnego MF.
- UPO jest pobierane z `Invoice.ksefUpoXml`, jeśli istnieje; seed nie ma UPO.
- PDF i XML obsługują także korekty (`kind=correction`): dokument wskazuje pierwotną FV (nigdy inną korektę), powód i zapisane różnice netto/VAT/brutto; XML używa `KOR`, `PrzyczynaKorekty` i `DaneFaKorygowanej`. Brak numeru KSeF pierwotnej FV blokuje XML (409).

#### Korekta

`POST .../invoices/:invoiceId/corrections` (owner/manager):

- tylko faktura `issued` i `ksefStatus=accepted`,
- nie można korygować korekty,
- body: `reason` + pozycje po korekcie (`lp`, `quantity`, `unitNet`); ilość 0 usuwa pozycję, pominięte bez zmian,
- kwoty dokumentu to **różnica** względem stanu przed korektą (mogą być ujemne); kolejna korekta liczy od poprzedniej,
- numer `KFV/n/MM/RRRR`, ten sam nabywca i środowisko,
- pozycje korekty pokazywane jako różnice; PDF/XML korekty eksportuje się jak zwykłą FV.

#### „Opłacona”

`POST .../invoices/:invoiceId/paid`:

- tylko faktura `issued`, nie korekta,
- `paidAt` opcjonalne ISO; nie z przyszłości (tolerancja 5 min) i nie przed wystawieniem,
- atomowe `paidAt: null` w warunku — drugi klik daje 409 i nie nadpisuje daty,
- płatność jest niezależna od KSeF i Stripe.

#### Wysyłka do KSeF z UI

`POST /api/studios/:studioId/invoices/:invoiceId/ksef` (owner/manager, Origin) kolejkuje wystawioną fakturę `not_sent` po zakończonym zleceniu. Środowisko pochodzi z faktury, nie z body. Serwer generuje FA(3), waliduje XSD, zapisuje niezmienny `KsefSubmission` (XML + SHA-256), status `queued` i zdarzenie `validated` w jednej transakcji, dopiero potem robi enqueue; sweep workera naprawia brak enqueue po awarii Redisa. Odpowiedź 202. Brak tokenu, NIP, zły kontekst TEST/PROD, wyłączona flaga PROD albo błąd walidacji → 409/400. Przycisk „Wyślij do KSeF” jest na szczegółach faktury (desktop i mobile). Samo dotarcie do MF zależy od działającego workera, tokenu studia i dostępności MF — repozytorium nie zawiera testu z prawdziwym MF.

#### E-mail z PDF

`POST …/invoices/:invoiceId/email` z `{ env }` (owner/manager, Origin) zapisuje `InvoiceMail` dla adresu klienta powiązanego z fakturą (brak poprawnego adresu → 400). Worker co 15 s wysyła mail z PDF jako załącznikiem (bez XML i bez linku portalu), z backoffem do 1 h i stałym Message-ID; `Invoice.emailedAt` oznacza przyjęcie przez SMTP, nie doręczenie. Dokumenty TEST mają „[TEST]” w temacie i nazwie załącznika. Bez SMTP w dev worker loguje podgląd i zostawia zadanie niewysłane. Dostarczenie jest „co najmniej raz”. Eksport PDF/XML sam w sobie nie zmienia `emailedAt`.

#### Numeracja i środowiska

- `FV/41/10/2026` jest numerem **w środowisku TEST**; TEST i PROD mają osobne liczniki i unikalność.
- `@@unique([studioId, ksefEnv, number])` oraz `@@unique([ksefEnv, ksefNumber])`.
- Seed FV/41 pochodzi z **#DF-0243** (zakończone 23.10.2026), nie z #DF-0248.
- Fakturę wystawia się po zakończeniu zlecenia; to nie jest FV/41 z #DF-0248.

### 9.10 KSeF 2.0 (TEST i PROD za flagą)

**Implementacja:** `src/ksef/`, `src/worker/ksef.ts`, `app/(studio)/settings`, `app/api/studios/[studioId]/ksef/token`.

- Domyślna ścieżka to **TEST**. `assertKsefTest()` odrzuca `KSEF_ENV` inne niż `test` oraz host inny niż `api-test.ksef.mf.gov.pl` (także przy `SKIP_ENV_VALIDATION=1`).
- PROD jest per studio (`Studio.ksefEnv`) i wymaga flagi `ksef_prod`. Badge w sidebarze i na karcie studia pokazuje TEST albo PROD. Właściciel przełącza środowisko na liście faktur i w ustawieniach studia. Zmiana kasuje zapisany token i wymaga potwierdzenia.
- Flaga `ksef_prod` (`FeatureFlag`) jest domyślnie **wyłączona** (seed, `ensureFeatureFlags`); brak wiersza też zamyka PROD. Przełącza ją operator `owner`/`admin` w A-08 po MFA (rola `support` nie może). Flaga nie zmienia `ksefEnv` żadnego studia — nie przenosi istniejących dokumentów ani tokenów.
- `KsefClient` implementuje: challenge, token RSA-OAEP/SHA-256, sesję FA(3), XML AES-256-CBC, status dokumentu, UPO XML, zamknięcie sesji. Timeout 20 s, bez przekierowań. Host wynika ze środowiska faktury: TEST albo `api.ksef.mf.gov.pl`. Tryb offline nie jest obsługiwany.
- Token studia jest szyfrowany AES-256-GCM. AAD i prefiks szyfrogramu wiążą go ze `studioId` i środowiskiem. TEST i PROD mają osobne klucze. Szyfrogram TEST nie odszyfruje się kluczem PROD.
- `PUT /api/studios/:studioId/ksef/token` wymaga właściciela (`studio:settings`) i Origin. Środowisko bierze z studia, nie z body. Odpowiedź 204 **nie zwraca tokenu**. NIP jest sprawdzany dopiero przy kolejkowaniu faktury. Dane sprzedawcy (nazwa, nazwa prawna, NIP ze sumą kontrolną, adres, kod, miasto, telefon) zapisuje właściciel na `/settings`.
- `queueKsefInvoice` (oraz `queueTestInvoice` dla TEST) jest **serwerowym punktem wejścia**, wołanym przez `POST …/invoices/:invoiceId/ksef`: wymaga wystawionej faktury po zakończonym zleceniu, waliduje XML FA(3) lokalnym XSD, zapisuje niezmienny snapshot + SHA-256 + status `queued` + event `validated`, dopiero potem enqueue. Żaden endpoint nie przyjmuje XML ani flagi „validated” od klienta.
- Kolejka `ksef-test`: 10 prób, backoff 5 s–5 min, respektuje `Retry-After`; payload zawiera tylko `studioId` i `invoiceId`.
- Worker przed POST zapisuje `sendStartedAt` i referencję sesji; po utracie odpowiedzi szuka dokumentu po hashu w tej samej sesji i **nie wysyła ponownie**.
- Odrzucenie danych (np. 450/NIP), błędy uprawnień i 4xx poza 429 kończą zadanie przez `UnrecoverableError` i status `rejected`, bez automatycznego retry.
- Błędy przejściowe → `retrying`; po wyczerpaniu prób status `retrying` zostaje w D-10 z informacją dla operatora.
- UPO jest zapisywane w `Invoice.ksefUpoXml`; numer i data przyjęcia pochodzą z MF.
- Nie logujemy treści odpowiedzi MF ani wyjątków z danymi/sekretami.
- `recoverKsefOutbox()` co 15 s znajduje faktury `queued` z submission i ponawia enqueue po awarii Redisa; faktury PROD są uwzględniane tylko przy włączonej fladze.
- `queueKsefInvoice` bierze środowisko z faktury. Token o prefiksie TEST przy env PROD kończy się 409, zanim powstanie XML.
- Ponowienie (`POST …/ksef/retry`, owner/manager): tylko dla faktur `rejected`/`retrying` bez numeru KSeF. Niejednoznaczny wynik (utracona odpowiedź, brak potwierdzonego odrzucenia) **nie** zastępuje XML i wymaga weryfikacji operatora; po potwierdzonym odrzuceniu danych XML jest generowany i walidowany od nowa, a NIP nabywcy można poprawić. Zaakceptowana faktura wymaga korekty, nie ponowienia.
- Kolejka nadal nazywa się `ksef-test`, ale obsługuje też faktury PROD (gdy flaga `ksef_prod` jest włączona).
- **Nie zweryfikowano w repozytorium:** wysyłki do prawdziwego MF (TEST ani PROD). Testy używają transportu zastępczego, a E2E Playwright kończy się na zadaniu w kolejce. Włączenie PROD wymaga decyzji operacyjnej i własnej weryfikacji; to nie jest deklaracja gotowości produkcyjnej.
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
- MRR: `calculateMrr` liczy tylko `active`, netto PLN; trial/past_due/suspended/canceled wykluczone. Przykład audytu: 64×79 + 48×149 + 16×279 = **16 672 zł**. Ta sama funkcja zasila A-01 i A-04 w panelu platformy ([§9.15](#915-panel-platformy-admin)).
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
- Worker sprząta niepotwierdzone uploady starsze niż 24 h (wiersz i obiekt S3); potwierdzone zdjęcia nie mają automatycznej retencji.
- Protokół: jeden na zlecenie, numer `P-0248` z `DF-0248`, maks. 30 punktów, pozycja `x`/`y` jako ułamek 0–1, opcjonalne zdjęcie **tego samego zlecenia**.
- Po akceptacji protokół jest niezmienny (409), także przy równoległym zapisie; akceptacja jest idempotentna.
- UI D-04/M-04 jest podłączone: lista zdjęć z podpisanego GET, upload presigned PUT + confirm, edytor punktów protokołu na schemacie i akceptacja (po niej formularz jest tylko do odczytu). W portalu klient widzi zdjęcia swojego zlecenia i może zaakceptować istniejący protokół ([§9.8](#98-portal-klienta)).
- Zdjęcia aut mogą zawierać tablice rejestracyjne i otoczenie; retencja potwierdzonych zdjęć nie jest zautomatyzowana (okres prawny nie jest ustawiony).

### 9.13 Zespół

**Implementacja:** `app/(studio)/team`, `src/server/studio/invitations.ts`, `src/server/studio/members.ts`.

- `/team` tylko owner/manager (`members:invite`); lista członków, oczekujące zaproszenia i formularz zaproszenia (e-mail + rola manager/worker).
- Zmiana roli (manager/worker) i usunięcie członka: `PATCH`/`DELETE /api/studios/:studioId/members/:membershipId`. Właściciel jest chroniony. Usunięcie zdejmuje przypisania tego członka do zleceń; obie operacje zapisują wpis `studio.member.*` w `AuditLog`.
- Wysłanie przez SMTP; przy braku SMTP w dev mail trafia do logu, w produkcji błąd.
- Link `/invite/[token]`; nowe konto bez hasła może zalogować się magicznym linkiem.
- Po przyjęciu cookie aktywnego studia ustawiane jest na zaproszone studio.
- Brak dezaktywacji członka bez usuwania, przekazania własności studia i egzekwowania limitu użytkowników planu.

### 9.14 Landing

**Implementacja:** `app/(marketing)/landing`, `components/landing`, `lib/landing/`.

- Jeden responsywny układ L-01/L-02; L-03 to pełnoekranowe menu mobilne.
- Gość na `/` dostaje rewrite na `/landing`, URL pozostaje `/`.
- Cennik: tylko miesięczny netto 79/149/279; brak przełącznika rocznego.
- Brak fikcyjnych opinii, gwiazdek i logotypów klientów; zamiast tego „SCENARIUSZ DEMO”.
- Kalkulator oszczędności jest **estymacją** na Decimal, z jawnymi założeniami; nie mierzy wyników klientów.
- „Zobacz demo (2 min)” to placeholder przewijający do podglądu pulpitu.
- Podgląd pulpitu to statyczna kopia D-01; zmiany D-01 trzeba przenieść ręcznie.
- Stopka linkuje do trzech szkiców prawnych (`/regulamin`, `/polityka-prywatnosci`, `/umowa-powierzenia`); każda strona ma widoczny komunikat „Projekt do zatwierdzenia prawnego. To nie jest obowiązujący dokument.” FAQ landingu mówi, że regulamin i polityka są „w przygotowaniu”. Nie ma linków do innych nieistniejących stron.
- Obietnice (KSeF, import Excel, brak karty, polski support) wymagają zatwierdzenia prawnego. Import XLSX istnieje; wysyłka KSeF z UI kolejkuje fakturę, ale nie ma dowodu z prawdziwym MF w repozytorium.

### 9.15 Panel platformy (/admin)

**Implementacja:** `app/(platform)/admin/**`, `src/server/admin/`, `components/admin/`, `lib/auth/platform.ts`. Specyfikacja ekranów i definicje metryk: `audit/admin/README.md` (jest to projekt UX z danymi demonstracyjnymi; stan implementacji opisuje [§3.3](#33-panel-platformy-a-01a-10)).

- **Osobna autoryzacja:** instancja Better Auth `platform` z cookie `df-plat`, bez wspólnej sesji ze studiem. Logowanie pod `/admin/login`; dostęp mają tylko użytkownicy z wierszem `PlatformOperator` (`owner`, `support`, `admin`). Lockout po błędnych hasłach ma osobny realm `platform`.
- **Dane:** wyłącznie `platformDb` (bez `studioDb`), czyli agregaty po wszystkich studiach. Panel nie ma dostępu do treści zleceń, zdjęć ani danych klientów studiów; karta studia pokazuje liczniki i metadane.
- **MFA TOTP:** sekret szyfrowany AES-256-GCM (klucz pochodny od `AUTH_SECRET`, dane powiązane z operatorem), kod 30 s z oknem ±1, ochrona przed powtórzeniem kroku (`lastAcceptedStep`), 8 jednorazowych kodów zapasowych (hash), potwierdzenie kodem na `PlatformMfaStepUp` ważne 12 h dla danej sesji. **MFA jest wymagane tylko do zmian ról i flag w A-08** (`assertMfaReady`); pozostałe akcje operatora — w tym zawieszenie konta, start sesji wsparcia i odpowiedzi na zgłoszenia — wymagają zalogowanego operatora, ale nie wymagają ponownego kodu. Operator demo z seeda nie ma włączonego MFA.
- **Role:** zmianę ról operatorów wykonuje tylko `owner` (nie można zdegradować ostatniego); flagi zmieniają `owner` i `admin`; `support` nie edytuje flag ani kosztów.
- **Sesja wsparcia (A-09):** wymaga powodu i numeru zgłoszenia, trwa 15 min (`SupportSession.expiresAt`) i zapisuje audyt. To **rekord autoryzacji**, nie podszywanie się pod użytkownika: nie ma sesji studia ani widoku danych studia „tylko do odczytu”, nie ma ręcznego zakończenia.
- **Zawieszenie (A-10):** wymaga wpisania nazwy studia i powodu; ustawia `Studio.status = suspended`, kasuje sesje użytkowników mających tylko to studio i blokuje zapisy przez billing. Nie anuluje subskrypcji w Stripe ani nie wysyła powiadomienia.
- **Audyt:** `AuditLog` (append-only z poziomu kodu aplikacji, bez UI do edycji/usuwania) zapisuje m.in. `platform.studio.view`, `platform.mfa.enabled`, `platform.operator.role`, `platform.flag.set`, `support.ticket.opened|replied|resolved`, `support.session.started`, `studio.suspended`. Nie zapisuje zmian kosztów (A-04) ani eksportu CSV; nie jest to dowód niezmienności na poziomie bazy (brak triggera ani WORM).
- **Metryki:** MRR to suma cen planów studiów `active` (`calculateMrr`); triale, `past_due`, `suspended` i `canceled` są poza MRR. Wpływy pochodzą z `SubscriptionPayment` zapisywanych idempotentnie z webhooka Stripe `invoice.paid`. To nie jest księgowość ani dowód płatności.
- **Czego nie ma:** zaproszeń i tworzenia operatorów w UI, wersji mobilnej panelu, formularza zgłoszeń po stronie studia, wysyłki odpowiedzi support mailem, mierzonych opóźnień/dostępności KSeF i zewnętrznych sond Stripe/poczty.

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

### 9.17 Magazyn chemii (#143)

`Chemical` jest modelem operacyjnym objętym `studioDb(studioId)`. Jednostka jest stała: `piece` (szt.) albo `ml`, ilość i próg są całkowite od 0 do 2 000 000 000, także w bazie. Nowe studio ma pustą listę — nie dosiewamy fikcyjnych stanów. Nie ma automatycznego zużycia przy zleceniu ani przeliczania jednostek. Odczyt: owner/manager/worker. Zapis: owner/manager, z istniejącą blokadą abonamentu (w tym wygasły trial).

- `GET/POST /api/studios/:studioId/inventory`: lista / utworzenie `{name, unit, quantity, lowThreshold, reason}`.
- `PATCH /api/studios/:studioId/inventory/:chemicalId`: jawna korekta `{quantity, lowThreshold, version, reason}`. To nowy zmierzony stan, nie przyrost. Jedno atomowe UPDATE z warunkiem wersji chroni przed utratą równoczesnej korekty; konflikt 409 wymaga odświeżenia. Cudzy i nieistniejący rekord dają ten sam 404. Zapisy wymagają sesji, roli, Origin i limitu API; UI używa Server Actions z takimi samymi kontrolami dostępu i Origin.
- Pulpit desktop, mobile i dzwonek czytają rzeczywiste pozycje z ilością ≤ progu z tego samego studia; po uzupełnieniu alert znika. Zachowany jest ostatni powód korekty, bez deklaracji pełnego dziennika magazynowego.

Migracja `20261029140000_chemical_inventory` wyłącznie dodaje enum, tabelę, indeks i ograniczenia; nie usuwa ani nie zmienia istniejących danych. #144–#151 i epik #115 pozostają osobnym zakresem.

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
| `GET/POST` | `/api/auth/[...all]` | publiczny | Better Auth studia (login, magic link, reset itd.) |
| `GET/POST` | `/api/auth/platform/[...all]` | publiczny | osobna instancja Better Auth operatorów platformy (cookie `df-plat`); UI pod `/admin/login` |
| `GET` | `/p/:token` | token | portal; brak efektów ubocznych |
| `POST` | `/p/:token/decision` | token + Origin | decyzja o wycenie; formularz, 303 |
| `POST` | `/p/:token/protocol` | token + Origin | akceptacja protokołu przyjęcia (link zlecenia); 303 |
| `GET` | `/p/media/:photoId?l=&e=&s=` | podpis HMAC | zdjęcie zlecenia dla portalu; podpis obejmuje id linku i zdjęcia oraz wygaśnięcie, nie zawiera tokenu; `no-store` |
| `GET` | `/p/quote-preview` | publiczny | placeholder „wkrótce” |

#### Studio i billing

| Metoda | Ścieżka | Dostęp | Opis |
| --- | --- | --- | --- |
| `POST` | `/api/studios/active` | sesja + `studio:select` + Origin | zapis aktywnego studia w cookie |
| `POST` | `/api/studios/:studioId/invitations` | owner/manager + Origin | zaproszenie `{ email, role }` |
| `GET` | `/api/studios/:studioId/members` | sesja + członkostwo | zespół i zaproszenia (`no-store`) |
| `PATCH/DELETE` | `/api/studios/:studioId/members/:membershipId` | `members:invite` + Origin | zmiana roli manager/worker, usunięcie; właściciel chroniony; wpis audytu |
| `PATCH` | `/api/studios/:studioId/settings` | owner + Origin | dane sprzedawcy i profil studia; wpis audytu |
| `POST` | `/api/studios/:studioId/bays` | owner + Origin | nowy boks; limit planu |
| `GET` | `/api/studios/:studioId/search?q=` | sesja | wyszukiwarka globalna (min. 2 znaki, po 4 wyniki: klienci, auta, zlecenia, faktury tylko owner/manager) |
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
| `POST` | `/api/studios/:studioId/clients/:clientId/privacy` | `clients:privacy` + Origin | `{ action: "export" \| "erase" }`: eksport JSON (`no-store`, attachment) albo anonimizacja/usunięcie; wpis audytu |
| `POST` | `/api/studios/:studioId/clients/import` | sesja + Origin | CSV w JSON, `text/csv` lub multipart `file`; XLSX multipart `file` |

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
| `POST` | `/api/studios/:studioId/quotes/:quoteId/order` | `quotes:write` + Origin | zlecenie z zaakceptowanej wyceny; kwota i pozycje z snapshotu |
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
| `POST` | `/api/studios/:studioId/invoices/:invoiceId/ksef` | `invoices:manage` + Origin | walidacja XSD, snapshot i kolejka KSeF dla środowiska faktury (202) |
| `POST` | `/api/studios/:studioId/invoices/:invoiceId/ksef/retry` | `invoices:manage` + Origin | ponowienie po `rejected`/`retrying`; opcjonalnie poprawiony NIP po potwierdzonym odrzuceniu |
| `POST` | `/api/studios/:studioId/invoices/:invoiceId/email` | `invoices:manage` + Origin | `{ env }` → outbox maila z PDF (202) |
| `PUT` | `/api/studios/:studioId/ksef/token` | owner (`studio:settings`) + Origin | zapis tokenu dla środowiska studia (204); NIP wymagany dopiero przy wysyłce |

#### Panel platformy (`/admin`)

Panel używa Server Actions i stron RSC pod `/admin/**` (osobna sesja operatora, [§9.15](#915-panel-platformy-admin)). Jedyny route handler to `GET /admin/studios/export` (CSV listy studiów, sesja operatora). Stripe webhook zapisuje także `SubscriptionPayment`.

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
- `Quote.status` to stan wyceny; `expired` ustawia worker ([§9.7](#97-wyceny)).
- `Studio.status` to stan billingu; `trial` po wygaśnięciu nadal jest `trial`, ale zapisy są zablokowane.

### 11.5 Ważne zakazy

- Nie wystawiaj faktury z aktywnego zlecenia.
- Nie wystawiaj drugiej aktywnej faktury na to samo zlecenie w tym samym środowisku.
- Nie koryguj korekty ani faktury nieprzyjętej w KSeF.
- Nie edytuj wysłanej wyceny.
- Nie zmieniaj zaakceptowanego protokołu.
- Nie mieszaj TEST i PROD KSeF.
- Nie używaj `platformDb` w kodzie studia (wyjątek: panel `/admin`, gdzie jest jedynym klientem bazy).
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
- **Lockout logowania**: 5 błędnych haseł w 15 min blokuje ten adres na 15 min (osobno dla studia i platformy). W bazie jest hash, nie e-mail. Rate limit auth jest dodatkowo współdzielony w Redis.
- **Panel platformy**: osobna sesja `df-plat`, rola operatora, MFA TOTP dla zmian ról i flag, audyt działań operatorów, sesja wsparcia jako rekord 15 min ([§9.15](#915-panel-platformy-admin)).
- **Audyt studia** (`AuditLog`): billing, profil/token/środowisko KSeF, zespół i RODO. Nie obejmuje zleceń, wycen ani faktur.
- **Nagłówki produkcyjne**: CSP i HSTS włącza `next.config.ts` tylko w `NODE_ENV=production`.
- **Observability**: logi pino JSON, Sentry (serwer, edge, klient, worker) z czyszczeniem sekretów (`src/observability/scrub.ts`) — aktywne dopiero po ustawieniu DSN.
- **Backup**: `pg_dump --format=custom` do prywatnego S3 z retencją; serwis Compose `backup`.
- **CI**: GitHub Actions (`check`, `db`, `docker`, `e2e`), w tym smoke Playwright (tylko na PR) na lokalnym buildzie z Postgresem i Redisem ([§13.3](#133-ci)).

### 12.2 Czego brakuje

Brak wymienionych elementów oznacza niezweryfikowane lub niezaimplementowane w repozytorium — nie dowód, że ryzyko nie istnieje.

- zatwierdzonych prawnie regulaminu, polityki prywatności i umowy powierzenia (strony `/regulamin` itd. to szkice),
- dowodu wysyłki do prawdziwego KSeF (TEST/PROD) i wyniku z MF; JPK, KSeF offline,
- MFA dla studia i MFA przy każdej akcji operatora platformy (kod jest wymagany tylko do zmian ról i flag),
- widoku „tylko do odczytu” i ręcznego zakończenia sesji wsparcia; audytu zleceń, wycen i faktur; niezmienności audytu na poziomie bazy,
- limitów API per plan i egzekwowania limitu użytkowników (zapisy studia mają wspólny limit 60/min na użytkownika),
- szyfrowania backupów po stronie aplikacji (zależy od konfiguracji bucketu), zautomatyzowanego testu odtwarzania i PITR,
- gotowych alertów i metryk (Sentry zbiera błędy; reguły alertów są poza repo),
- testów obciążeniowych oraz E2E poza 10 smoke (m.in. brak E2E logowania operatora z MFA i sesji wsparcia — pokrywają je testy integracyjne `src/server/admin`),
- automatycznej retencji zdjęć i konfiguracji proxy/APM maskującej `/p/*`.

### 12.3 RODO — praktyczne uwagi

- Karta `/customers/[clientId]`: owner/manager eksportuje JSON albo usuwa dane osobowe przez audytowane API `POST .../clients/:clientId/privacy`. Historia zleceń zostaje zanonimizowana, faktury i zapisany XML KSeF pozostają. Zdjęcia są usuwane z S3, linki portalu odwoływane. To narzędzie operacyjne, nie potwierdzenie kompletnej zgodności prawnej.

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
| `RATE_LIMIT_REDIS_TEST_URL` | włącza test atomowego limitu między dwoma procesami (CI: DB 14); testy jednostkowe używają fałszywego licznika |
| `xmllint` w PATH | wymagany do walidacji XSD FA(3) |

### 13.2 Co jest pokryte

- **Domena:** cena, VAT, zaokrąglanie, czas, katalog, oszczędności landingu.
- **Tenant:** `studioDb` (where/data/update/upsert, blokady), dwa studia w testach.
- **Auth:** hasła, redirect, sesje, rejestracja, zaproszenia, role, CSRF/Origin.
- **Billing:** plany, Checkout, webhooki, idempotencja, race, retry, trial, MRR, read-only.
- **Klienci:** CSV/XLSX, 20/stronę, duplikat tablicy, izolacja.
- **Kalendarz:** kolizje, DST, CRUD, równoległe zapisy.
- **Zlecenia:** przejścia, etapy, historia, numeracja, `canInvoice`.
- **Wyceny:** zapis, wysyłka, outbox, błąd SMTP, link portalu.
- **Portal:** hash/TTL/revoke, P-02, decyzja, wyścig dwóch linków.
- **Faktury:** walidacja dokumentu, PDF, FA(3), XSD, numeracja TEST/PROD, korekty, płatność.
- **KSeF:** kontrakt HTTP z podmienionym transportem, kryptografia, worker, retry, UPO, restart.
- **UI:** kluczowe ekrany, stany, dostępność podstawowa, mobile.
- **Panel platformy:** agregaty (MRR, aktywacja, KSeF), MFA TOTP i step-up, polityka ról, sesja wsparcia i zawieszenie, wsparcie/SLA, koszty, flagi, audyt — `src/server/admin/*.test.ts` na prawdziwym Postgresie, `components/admin/*.test.tsx`, `prisma/seed.test.ts`.
- **Obserwacja i kopie:** scrubbing sekretów Sentry, konfiguracja, `pg_dump`, retencja i harmonogram backupu, health, logger.
- **RODO, zespół, wyszukiwanie, boksy, wygasanie wycen, sprzątanie zdjęć:** testy w odpowiednich `src/server/*`.

### 13.3 CI

`.github/workflows/ci.yml` uruchamia się na `pull_request` i `push` do `main`; ma cztery joby:

1. **typecheck + build** (`check`): `prisma validate`, `lint`, `typecheck`, `build` z `SKIP_ENV_VALIDATION=1`.
2. **migrate + seed + test** (`db`): PostgreSQL 16 + Redis 7, `migrate deploy`, `migrate diff --exit-code`, seed **dwa razy** (test resetu), `libxml2-utils`, `pnpm test` (z `KSEF_REDIS_TEST_URL` i `RATE_LIMIT_REDIS_TEST_URL`).
3. **docker build** (`docker`): build target `runner`, bez push.
4. **playwright smoke** (`e2e`): **tylko na `pull_request`**; Postgres + Redis, migracje, seed, `pnpm build`, `pnpm test:e2e:smoke` (testy z tagiem `@smoke`: pulpit, wycena, wycena → zlecenie, portal, klienci, zespół, billing → A-04, faktura blokowana dla otwartego zlecenia, golden path zlecenie → faktura → kolejka KSeF TEST, akcje pulpitu). Stripe jest tam zastąpiony lokalnym stubem, a KSeF nie łączy się z MF.

Brak progu coverage, testów obciążeniowych i testów z prawdziwym Stripe/MF.

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
- Stripe (test/live) i KSeF TEST (PROD tylko po osobnej decyzji operacyjnej i włączeniu flagi `ksef_prod`).

### 14.4 Checklist produkcyjny

- [ ] `APP_URL` = publiczny HTTPS origin; żadnego `localhost`.
- [ ] `AUTH_SECRET` losowy, poza repo.
- [ ] `DATABASE_URL` do produkcyjnej bazy; migracje z `migrate deploy`.
- [ ] `S3_PUBLIC_ENDPOINT` osiągalny z przeglądarki; bucket prywatny.
- [ ] `SMTP_URL` i `EMAIL_FROM` działają; test magic linku i resetu.
- [ ] `STRIPE_SECRET_KEY` live, `STRIPE_WEBHOOK_SECRET` live, endpoint `POST /api/stripe/webhook`.
- [ ] `pnpm billing:setup` z kluczem live; ceny i `lookup_key` zgodne.
- [ ] Stripe Tax i Customer Portal skonfigurowane osobno dla live.
- [ ] `KSEF_ENV=test`, `KSEF_API_URL` test, `KSEF_TOKEN_ENCRYPTION_KEY` 32 bajty. Dla PROD osobny klucz produkcyjny, flaga `ksef_prod` świadomie włączona i token studia z MF; repozytorium nie zawiera dowodu wysyłki do prawdziwego MF.
- [ ] **Nie uruchamiaj `pnpm db:seed` na produkcji**: tworzy dane demo, w tym operatora platformy z jawnym hasłem z README. Operatorzy produkcyjni (`PlatformOperator`) nie mają UI zaproszeń ani skryptu w repo — wymagają osobnej, kontrolowanej procedury, a każdy musi włączyć MFA.
- [ ] `AUTH_SECRET` (≥ 32 znaki) jest też źródłem klucza szyfrującego sekrety MFA operatorów; jego rotacja unieważnia zapisane sekrety MFA (operatorzy muszą wtedy zainicjować MFA od nowa).
- [ ] Worker działa i ma połączenie z Redis/SMTP/KSeF.
- [ ] `SENTRY_DSN` (i ewentualnie `NEXT_PUBLIC_SENTRY_DSN`) wskazują projekt Sentry. Bez DSN błędy nie wychodzą z procesu.
- [ ] `pnpm backup` przechodzi, a serwis `backup` zostawia dumpy w `BACKUP_S3_PREFIX` i kasuje starsze niż `BACKUP_RETENTION_DAYS`. Odtworzenie: `pg_restore` na kopię.
- [ ] Alerty na 503 z `/api/health` i na nowe issue w Sentry (poza repo).
- [ ] Reverse proxy maskuje `/p/*` w logach i body odpowiedzi.
- [ ] Przejrzeć `/regulamin`, `/polityka-prywatnosci` i `/umowa-powierzenia`; uzupełnić zweryfikowane dane stron i uzgodnienia.
- [ ] Uzyskać zatwierdzenie prawne wszystkich trzech dokumentów i przygotować wymagane zgody. Strony są wyłącznie szkicami; publikacja jako obowiązujących dokumentów czeka na człowieka.
- [ ] Test zakupu kartą testową i webhooka; test reseed na kopii.

### 14.5 Backup i odtwarzanie

- Backup: `pnpm backup` albo serwis Compose `backup` (`pg_dump --format=custom`, plik `backups/postgres/detailflow-….dump` w prywatnym buckecie). Hasło bazy idzie przez `PGPASSWORD`, nie przez argumenty procesu. Retencja domyślnie 14 dni; najnowszy dump zostaje nawet, gdy jest starszy. Osobnego klucza szyfrującego dumpa nie ma w aplikacji — na produkcji włącz SSE bucketa i osobne konto S3 tylko do backupu.
- Odtwarzanie: `pg_restore --no-owner` do osobnej bazy, `migrate deploy`, smoke test, dopiero potem przełączenie.
- Backup powinien obejmować też bucket S3 (zdjęcia, UPO) albo mieć politykę odtwarzania obiektów.
- Logi i metryki nie mogą zawierać tokenów portalu, sekretów KSeF, payloadów Stripe ani danych klientów.

### 14.6 Skalowanie

- Aplikacja jest bezstanowa (poza cookie); można uruchomić wiele instancji web.
- Rate limit auth i zapisów API wymaga dostępnego Redisa; obserwuj 429/503 przed skalowaniem.
- Workerów nie skaluj bez analizy: outbox ma blokady wierszy, ale kolejność locków i idempotencja muszą zostać zachowane.
- KSeF worker ma `concurrency: 2`; zwiększanie wymaga testów limitów MF.
- Next dev nie jest produkcyjny; używaj `pnpm build` + `pnpm start`/standalone.

---

## 15. Luki i plan

### 15.1 Co jest zamknięte względem wcześniejszego planu

Wcześniejsza wersja tej sekcji wymieniała jako luki rzeczy, które dziś istnieją w kodzie i testach: tworzenie zleceń (`POST /orders`, formularz), status i etapy z UI, kreator faktury wystawiający FV, wysyłkę KSeF z UI, mail z fakturą, wygasanie wycen, status/zdjęcia/protokół w portalu, listę członków, wyszukiwarkę, PDF/XML korekt, ponowienie KSeF, CSP/HSTS, Sentry, backup, E2E w CI oraz panel `/admin` z MFA, audytem i sesją wsparcia. Stan każdej z tych funkcji jest w [§3](#3-status-wdrożenia).

### 15.2 Luki i ryzyka przed realnym użyciem

To nie jest lista blokad „kodowych” — część pozycji wymaga decyzji, dowodów lub zasobów poza repozytorium.

| Luka | Wpływ | Co trzeba zrobić |
| --- | --- | --- |
| Brak dowodu wysyłki do prawdziwego KSeF (TEST ani PROD) | nie wiadomo, jak kod zachowa się wobec rzeczywistego MF | test na koncie TEST MF z tokenem studia, zapis wyniku i UPO; dopiero potem decyzja o PROD |
| Szkice prawne (`/regulamin`, `/polityka-prywatnosci`, `/umowa-powierzenia`) | nie można publikować jako obowiązujących | zatwierdzenie przez prawnika, DPA, zgody, procedura naruszeń |
| Retencja zdjęć i danych klientów | RODO | ustalić okres i automatyczne usuwanie; maskowanie `/p/*` w proxy/APM |
| Operatorzy platformy bez UI zaproszeń; MFA tylko przy zmianie ról/flag | ryzyko operacyjne | procedura tworzenia operatorów, rozważyć MFA przy zawieszeniu i sesji wsparcia |
| Sesja wsparcia to rekord, nie podgląd danych studia; brak ręcznego zakończenia | A-09 niepełne | zaprojektować widok tylko do odczytu z audytem każdego odczytu |
| Metryki A-06 nie mierzą dostępności MF, Stripe ani poczty | operator nie widzi realnego stanu zależności | sondy zewnętrzne i alerty (poza repo) |
| Backup bez automatycznego testu odtwarzania i PITR | nieznany RTO/RPO | cykliczny restore na kopię, PITR w bazie zarządzanej |
| Brak limitów planów dla liczby użytkowników; boksy tylko przez API | plany nie są w pełni egzekwowane | UI boksów i egzekwowanie limitów |
| Poza ukończonym zakresem | — | JPK, KSeF offline, abonament roczny, płatność online klienta (osobno od Stripe Billing), statystyki, portfolio, SMS. Katalog usług i magazyn chemii są wdrożone. Moduły #142–#151 wchodzą pojedynczo |

### 15.3 Znane drobne niedokończenia

- terminy w kreatorze wyceny (`quoteSlots`) są demonstracyjne,
- przycisk „Link dla klienta” na karcie zlecenia jest „Wkrótce” (API i pulpit działają),
- `app/p/quote-preview` to placeholder,
- „Cała historia” na karcie klienta jest „Wkrótce”,
- „Statystyki” i „Portfolio” pozostają „Wkrótce”; „Usługi i cennik” jest katalogiem `/services`, a „Magazyn” prowadzi do `/inventory`,
- brak przypomnień o wygasających wycenach, brak wysyłki SMS,
- brak panelu zgłoszeń po stronie studia i wysyłki odpowiedzi supportu e-mailem.

### 15.4 Kierunek

Kolejność prac wynika z issue i faz w [`docs/dokumentacja-wdrozenia.md`](docs/dokumentacja-wdrozenia.md). Moduły #142–#151 są wybrane i wchodzą pojedynczo; ten opis nie oznacza, że wszystkie są już ukończone. Stripe Billing zostaje abonamentem Detailflow i nie obsługuje płatności klienta za detailing.

---

## 16. Dokumentacja źródłowa

| Dokument | Co zawiera |
| --- | --- |
| [`AGENTS.md`](AGENTS.md) | zasady pracy agentów, etykiety, twarde reguły produktu |
| [`docs/dokumentacja-wdrozenia.md`](docs/dokumentacja-wdrozenia.md) | specyfikacja docelowego produktu (nie opis stanu kodu): architektura, Prisma, Stripe, KSeF, fazy |
| [`docs/README.md`](docs/README.md) | indeks dokumentacji |
| [`file-structure.md`](file-structure.md) | mapa ekranów Figmy, dane demo, zakres prototypu |
| [`audit/admin/README.md`](audit/admin/README.md) | projekt UX i definicje metryk panelu platformy A-01–A-10 (dane demo; stan kodu: [§3.3](#33-panel-platformy-a-01a-10)) |
| [`src/server/admin/README.md`](src/server/admin/README.md) | logika panelu platformy |
| [`e2e/README.md`](e2e/README.md) | smoke Playwright |
| [`docs/naprawa-migracji-coating-reminders.md`](docs/naprawa-migracji-coating-reminders.md) | procedura naprawy historii migracji |
| [`src/server/README.md`](src/server/README.md) | ACL, zlecenia, wyceny, klienci — skrót |
| [`src/server/billing/README.md`](src/server/billing/README.md) | Stripe, webhooki, trial, read-only, MRR |
| [`src/ksef/README.md`](src/ksef/README.md) | KSeF TEST/PROD, token, worker, retry |
| [`src/server/zlecenia/README.md`](src/server/zlecenia/README.md) | zdjęcia, protokół, stan zlecenia |
| [`src/server/wyceny/README.md`](src/server/wyceny/README.md) | zapis i wysyłka wycen |
| [`src/server/portal/README.md`](src/server/portal/README.md) | tokeny i decyzja portalu |
| [`src/server/klienci/README.md`](src/server/klienci/README.md) | CRUD, CSV/XLSX, paginacja |
| [`src/server/kalendarz/README.md`](src/server/kalendarz/README.md) | rezerwacje i kolizje |
| [`components/*/README.md`](components) | szczegóły ekranów i odstępstw od Figmy |
| [`branding/`](branding) | logo Flowcut (SVG) |
| [Figma](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S) | źródło prawdy UI |
| [Issues](https://github.com/JaMkAAaa/detailflow/issues) | backlog, epiki, zadania `agent-ready` |

**Uwaga o rozbieżności:** `docs/dokumentacja-wdrozenia.md` opisuje docelowy produkt i miejscami wyprzedza kod albo go nie zawiera (np. pełne Ustawienia, JPK, wersja roczna, automatyczne zużycie chemii). Ten README opisuje **stan faktyczny** i wskazuje luki. Przy sprzeczności: kod i migracje > ten README > dokumentacja wdrożenia > makieta.

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
- Wybrane moduły #142–#151 wchodzą pojedynczo. Jeszcze bez własnego wdrożenia: statystyki, portfolio, KSeF offline, abonament roczny, płatność online klienta. Stripe Billing zostaje abonamentem Detailflow.
- Menu: „Usługi i cennik” to katalog studia. „Magazyn” prowadzi do `/inventory`. „Statystyki / Portfolio” = „Wkrótce”, nie 404 i nie pusty CRUD.
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
| **KSeF** | Krajowy System e-Faktur; w kodzie TEST domyślnie, PROD per studio za flagą `ksef_prod` (bez dowodu z prawdziwym MF) |
| **UPO** | Urzędowe Poświadczenie Odbioru dokumentu z KSeF |
| **Trial** | 14-dniowy okres próbny bez karty |
| **Read-only** | tryb po wygaśnięciu trialu/`past_due`/`suspended`/`canceled`; GET działa, zapisy 403 |
| **Outbox** | trwała tabela zadań do wysłania (mail), przetwarzana przez workera |
| **BullMQ** | kolejka Redis dla KSeF i billing-daily |
| **Operator platformy** | użytkownik `PlatformOperator` (owner/support/admin) z dostępem do `/admin`; nie jest członkiem studia |
| **Sesja wsparcia** | 15-minutowy, audytowany rekord zgody na obsługę konkretnego studia; nie loguje jako użytkownik |
| **Step-up MFA** | potwierdzenie kodem TOTP ważne 12 h dla sesji operatora |
| **Presigned URL** | czasowy podpisany URL do S3, ważny 5 min |
| **Tenant guard** | `studioDb` + złożone FK wymuszające `studioId` |
| **RSC** | React Server Components w Next.js App Router |
| **MRR** | miesięczny przychód z aktywnych abonamentów netto; bez trialów i zaległości |
| **P-01 / P-02** | ekrany portalu: status zlecenia (3 etapy) i wygasły/nieprawidłowy link |
| **D-01…D-10 / M-01…M-08** | ekrany desktop/mobile w Figmie |
| **A-01…A-10** | ekrany panelu platformy pod `/admin` ([§3.3](#33-panel-platformy-a-01a-10)) |

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

Przycisk „Wyślij do KSeF” jest na szczegółach wystawionej faktury o statusie `not_sent`, na desktopie i mobile. Token zapisuje właściciel w `/settings`; lista faktur i szczegóły mają link do ustawień. Endpoint wybiera środowisko z faktury. Brak tokenu, zły kontekst TEST/PROD lub błąd walidacji dają 409. Walidacja wymaga `xmllint` i lokalnych plików `src/ksef/xsd/`; obraz Docker zawiera oba. Ponowienia odrzuconych dokumentów pozostają osobnym zakresem #138.

### Panel `/admin`: nie mogę się zalogować / MFA

- Panel ma własne logowanie `/admin/login` i cookie `df-plat`; konto studia nie działa. Operator musi mieć wiersz `PlatformOperator` (po `pnpm db:seed` jest `anna.nowak@detailflow.test`, dane w [§2.2](#22-wariant-docker-zalecany)).
- Zmiany ról i flag w A-08 wymagają włączonego MFA i kodu z ostatnich 12 h. Utracone urządzenie: kody zapasowe; jeśli ich brak, reset wymaga ręcznej interwencji w bazie (brak UI).
- Zmiana `AUTH_SECRET` unieważnia zapisane sekrety MFA.
- Pusty panel po świeżej migracji bez seeda jest poprawny: liczby w A-01–A-05 pochodzą z danych w bazie.

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

Repozytorium zawiera działającą aplikację v1 na danych z bazy: izolację tenantów, auth, kalendarz, klientów, zlecenia, wyceny, portal klienta, faktury z PDF/FA(3), kolejkę KSeF TEST (PROD za flagą), billing Stripe, backup, Sentry, CI z E2E i panel platformy `/admin` z MFA, audytem i sesją wsparcia. Nie ma natomiast dowodów, które nie mogą pochodzić z repozytorium: wysyłki do prawdziwego MF, zatwierdzenia prawnego dokumentów, testu odtwarzania backupu ani zewnętrznego monitoringu — dlatego README nie deklaruje gotowości produkcyjnej ani prawnej. Szczegóły i ograniczenia: [§3](#3-status-wdrożenia) i [§15](#15-luki-i-plan); szczegóły modułów — w linkowanych dokumentach.
