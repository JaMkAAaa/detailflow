# Detailflow — dokumentacja wdrożenia aplikacji

**Wersja:** 1.0  
**Data:** 26 października 2026  
**Źródło projektu graficznego:** [Figma — Detailflow](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S)  
**Stan projektu UX:** prototyp po audycie, dane demonstracyjne, nie podłączony system  

Ten dokument jest instrukcją wdrożenia produktu na podstawie gotowego projektu graficznego. Opisuje **co budujemy**, **dla kogo**, **jakie problemy rozwiązujemy**, **jakie ekrany i przepływy są w zakresie**, oraz **jak złożyć to na stacku PostgreSQL + Next.js + Prisma + Docker + Stripe**.

---

## 1. Streszczenie dla zespołu

Detailflow to **polski SaaS operacyjny dla studiów detailingowych**. Zastępuje Excel, notes, WhatsApp i przypadkowe foldery ze zdjęciami jednym systemem:

- właściciel i zespół prowadzą dzień pracy studia (boksy, zlecenia, klienci, wyceny, faktury),
- klient śledzi auto na żywo przez link, bez konta,
- platforma Detailflow rozlicza studia abonamentem (Stripe) i nadzoruje zdrowie produktu.

Hasło oferty z landingu: **„Twoje studio detailingu. Bez Excela. Bez chaosu.”** Okres próbny: **14 dni, bez karty**. Cennik miesięczny netto: **Solo 79 zł · Studio 149 zł · Pro 279 zł**. Opcja roczna jest poza v1.

Aplikacja ma **cztery powierzchnie**:

| Powierzchnia | Użytkownik | Cel |
| --- | --- | --- |
| Landing `detailflow.pl` | prospect | sprzedaż, trial, demo |
| Panel studia | właściciel / pracownik | operacje dnia |
| Portal klienta | klient studia | status auta, wycena, odbiór |
| Panel właściciela platformy | operatorzy Detailflow | SaaS, KSeF, wsparcie, billing |

---

## 2. Problem i zadanie produktu

### 2.1 Problem, który rozwiązujemy

Studia detailingowe tracą pieniądze i czas, bo praca jest rozproszona:

1. **Kalendarz w głowie lub Excelu** — kolizje boksów, brak widocznego „teraz” i wolnego okna.
2. **Zlecenia w czacie** — nie wiadomo, na którym etapie jest auto, kto robi korektę, kiedy odbiór.
3. **Wyceny „na oko”** — brak mnożników za wielkość auta i stan lakieru, każda cena liczona od zera.
4. **Klient dzwoni co godzinę** — nie ma prostego statusu „gdzie jest moje auto”.
5. **Faktury i KSeF 2.0** — od 2026 e-Faktura FA(3) jest obowiązkowa dla rosnącej grupy podatników; Excel i ręczny PDF nie wystarczą.
6. **Brak historii auta** — rysy przy przyjęciu giną, reklamacje są sporne, serwis powłoki nie wraca do klienta.
7. **Właściciel nie widzi, czy studio zarabia** — przychód, obłożenie, powracający klienci i zaległe faktury są w osobnych miejscach.

### 2.2 Zadanie produktu

Zadanie Detailflow: **domknąć dzień studia detailingowego od przyjęcia auta do faktury KSeF i odbioru przez klienta**, w jednym ciemnym, szybkim interfejsie, na desktopie i telefonie pracownika.

Produkt ma:

- dać **kontrolę operacyjną** (boksy, statusy, alerty),
- dać **kontrolę finansową** (wycena → zlecenie → faktura → KSeF → płatność),
- dać **zaufanie klienta** (portal ze statusem i akceptacją wyceny),
- dać **przychód platformy** (abonament Stripe, trial, windykacja, panel operatora).

### 2.3 Jak rozwiązujemy problem (mechanika)

| Problem studia | Mechanizm w produkcie |
| --- | --- |
| Chaos w grafiku | Kalendarz zasobowy: boks × oś czasu, status W trakcie / Zaplanowane, linia „teraz” |
| Zlecenia „gdzieś w czacie” | Tablica Kanban: Przyjęte → W trakcie → Do odbioru → Zakończone + karta zlecenia |
| Cena liczona w Excelu | Kreator wyceny z katalogiem, mnożnikami (rozmiar × stan lakieru) i VAT 23% |
| Klient dzwoni o status | Magiczny link do portalu; postęp uproszczony do 3 etapów |
| Reklamacje o rysy | Protokół przyjęcia ze schematem auta, punktami uszkodzeń i zdjęciami |
| Faktury i KSeF | Wystawienie po zakończeniu zlecenia, kolejka TEST/PROD, UPO, korekta, PDF |
| Zgubione relacje | Baza klientów i aut, historia wizyt, alert serwisu ceramiki |
| Właściciel platformy nie widzi SaaS | Panel A-01–A-10: MRR, studia, Stripe, aktywacja, KSeF, wsparcie, audyt |

---

## 3. Użytkownicy i role

### 3.1 Studio (tenant)

| Rola | Co robi | Uwagi z projektu |
| --- | --- | --- |
| Właściciel studia | pełny dostęp, billing studia, KSeF, faktury, ustawienia | w makiecie: Michał Kowalski, Obsidian Studio, Warszawa Mokotów |
| Pracownik | kalendarz, zlecenia, zdjęcia, zmiana etapu, telefon | w kalendarzu: Michał (korekta), Kamil (mycie i wnętrza) |
| Recepcja / biuro (v1 opcjonalnie) | wyceny, klienci, faktury | ta sama aplikacja, węższe uprawnienia |

### 3.2 Klient studia

Nie zakłada konta. Dostaje **wygasający link**. Widzi auto, postęp, termin odbioru, kwotę wyceny i przycisk „Zadzwoń do studia”. Osobno: akceptacja wyceny (do zaprojektowania / do wdrożenia jako TODO z prototypu).

### 3.3 Operatorzy platformy Detailflow

Role z A-08: właściciel platformy, wsparcie, administracja. **MFA obowiązkowe**. Sesja wsparcia to **audytowany tryb tylko do odczytu, max 15 min** — nigdy ciche „zaloguj się jako studio”.

---

## 4. Powierzchnie produktu i elementy UI

Źródło nazw ekranów: `file-structure.md` i plik Figma. Prefiks: **L** landing, **D** desktop studia, **M** mobile studia, **P** portal, **S** stany, **B** brand, **A** admin platformy.

### 4.1 Landing — detailflow.pl

| ID | Ekran | Zadanie wdrożeniowe |
| --- | --- | --- |
| L-01 | Desktop | Hero, demo pulpitu, wartość, cennik 79/149/279, CTA trial 14 dni, demo 2 min |
| L-02 | Mobile | Ten sam przekaz, telefon z pulpitem pracownika |
| L-03 | Menu landingu | Nawigacja i CTA |

Obietnice na landingu (do zatwierdzenia prawnie przed publikacją):

- faktury z wysyłką do **KSeF 2.0**,
- start **bez karty kredytowej**,
- import klientów z Excela,
- polski support,
- kalkulator oszczędności jest **estymacją**, nie pomiarem wyników klientów.

Fikcyjne opinie i logotypy klientów **nie idą na produkcję**. Zastępujemy je scenariuszami demo albo prawdziwymi case’ami po zgodzie.

### 4.2 Aplikacja studia — desktop

| ID | Moduł / ekran | Elementy |
| --- | --- | --- |
| D-01 | Pulpit / Przegląd dnia | KPI (przychód, aktywne zlecenia, obłożenie, powracający klienci), mini-plan boksów, lista „dziś”, karta „na warsztacie”, alerty |
| D-02 | Kalendarz / Boksy — dzień | Osie 08:00–18:00, Boks 01/02, filtry dzień/tydzień, osoby, nowa rezerwacja |
| D-03 | Zlecenia / Tablica | Kanban 4 kolumn, wyszukiwanie, filtry pracownik/usługa, widok lista |
| D-04 | Zlecenia / Szczegóły — Przegląd | Zdjęcia, protokół przyjęcia, postęp 4 etapów, wycena, kontakt, link klienta |
| D-05 | Klienci / Lista i karta | 20 wierszy/stronę, 124 klientów demo, karta: auta, historia, stały klient |
| D-06 | Wyceny / Nowa — krok 2 | Wizard 3 kroków, mnożniki, katalog, VAT, szkic vs wysyłka |
| D-07 | Faktury / Lista | Statusy, „do uwagi”, wyszukiwanie |
| D-08 | Faktury / Nowa — krok 2 Pozycje | Wizard analogiczny do wyceny |
| D-09 | Faktury / Szczegóły i KSeF | Podgląd FV, numer KSeF, historia wysyłki, UPO XML, PDF, korekta |
| D-10 | Faktury / Wymagają uwagi | Odrzucenia KSeF, zaległości, błędy NIP |

Nawigacja sidebara (IA docelowa): Pulpit, Kalendarz, Zlecenia, Faktury, Klienci i auta, Usługi i cennik, Magazyn, Statystyki, Portfolio. **Trzy ostatnie + pełne Ustawienia/Konto są poza v1** — pozycje mogą być widoczne jako „wkrótce”, nie jako puste moduły.

Akcje globalne pulpitu (wersja po audycie): **Nowa wycena**, **Wystaw fakturę**, **+ Nowe zlecenie**, paleta ⌘K.

### 4.3 Aplikacja studia — mobile

Pracownik na hali. Dolny tab bar: Pulpit, Kalendarz, **+**, Zlecenia, Więcej.

| ID | Ekran | Elementy |
| --- | --- | --- |
| M-01 | Pulpit / Dziś | KPI, karta auta na warsztacie, „Zakończ: [etap]”, aparat, lista dnia |
| M-02 | Kalendarz / Dzień | Kompaktowy widok boksów |
| M-03 | Zlecenia / Lista | Wszystkie 7 aktywnych w scrollu |
| M-04 | Zlecenia / Szczegóły | Postęp, zdjęcia, telefon do klienta |
| M-05 | Wyceny / Nowa — krok 2 | Uproszczony kreator; rozszerzone opcje są TODO |
| M-06 | Więcej / Menu | Faktury, klienci, pomoc, konto |
| M-07 | Faktury / Lista | Statusy i „do uwagi” |
| M-08 | Faktury / Szczegóły | KSeF, PDF, oznacz jako opłaconą |

### 4.4 Portal klienta

| ID | Ekran | Elementy |
| --- | --- | --- |
| P-01 | Status zlecenia | Branding studia (logo Flowcut + nazwa studia), auto, 3 etapy, odbiór, wycena, telefon |
| P-02 | Wygasły link | Gotowy stan; token nieważny, prośba o nowy link |
| TODO | Akceptacja wyceny | Decyzja tak/nie + potwierdzenie |

Portal **upraszcza 4 etapy studia do 3**: przyjęcie i mycie → korekta → ceramika i kontrola. Ostatni etap studia (kontrola i odbiór) jest w portalu częścią etapu 3.

### 4.5 Stany i wzorce

| ID | Zawartość | Implementacja |
| --- | --- | --- |
| S-01 | Puste stany i błędy | Empty, 404, błąd sieci, brak wyników filtra |
| S-02 | Interakcje | Focus 2 px + offset 2 px, hover, clipboard, tooltip numeru KSeF |
| S-03 | Zakres | Legenda v1 vs później |

Skeletony KPI/tabeli/kalendarza są statyczne w Figmie. W aplikacji: pulsowanie + `prefers-reduced-motion`.

### 4.6 Panel właściciela platformy (tylko desktop w tej iteracji)

| ID | Widok | Elementy |
| --- | --- | --- |
| A-01 | Przegląd | MRR, płacące, triale, aktywność, wykres, lejek aktywacji, kolejka „do reakcji” |
| A-02 | Lista studiów | 166 kont demo, filtry Aktywne/Trial/Zaległe/Wstrzymane, CSV |
| A-03 | Karta studia | Kontakt, limity, Stripe, zdarzenia, narzędzia dostępu |
| A-04 | Abonamenty | Skład MRR Solo/Studio/Pro, wpływy, zaległości, koszty, retry Stripe |
| A-05 | Analityka | Aktywacja, konwersja trialu, retencja kohortowa, użycie funkcji |
| A-06 | System i KSeF | Kondycja usług, kolejka, incydent, TEST vs PROD osobno |
| A-07 | Wsparcie | Kolejka, SLA, wątek, kontekst konta |
| A-08 | Administracja | Role, MFA, flagi, dziennik audytu |
| A-09 | Sesja wsparcia | Powód, zgłoszenie, read-only, 15 min |
| A-10 | Zawieszenie konta | Konsekwencje, powód, wpisanie nazwy studia |

### 4.7 System designu (do przeniesienia 1:1)

**Logo:** Flowcut — monogram D z wyciętym F, kolor limonki. Wordmark `detailflow` w Space Grotesk Bold. W portalu klienta: znak + **nazwa studia**, nie „detailflow”.

**Tokeny koloru (CSS):**

```css
:root {
  --df-bg: #101214;
  --df-side: #17191C;
  --df-panel: #1B1E21;
  --df-raised: #24282C;
  --df-line: #30353A;
  --df-text: #F2F4F5;
  --df-muted: #9CA5AC;
  --df-lime: #D3F66A;
  --df-lime-dark: #2B3521;
  --df-blue: #A7C8FF;
  --df-blue-dark: #243044;
  --df-amber: #F0C589;
  --df-amber-dark: #392F23;
  --df-green: #8ED9B0;
  --df-error: #FF6B6B;
  --df-error-surface: #3D1A1A;
  --df-success-surface: #1B3027;
}
```

**Typografia:** Inter. Body 13 Regular, Label 12 Medium, Strong 14 Semi Bold, Section 17 Semi Bold, Headline / Number 30. Kanban: część etykiet 13 px.

**Semantyka koloru:**

- limonka — główna akcja i praca w toku,
- niebieski — zaplanowane / do odbioru,
- zieleń — przyjęte w KSeF TEST / zakończone / zaakceptowane,
- bursztyn — szkic, zaległość, niski stan, degradacja,
- czerwień — błąd, odrzucenie KSeF, zawieszenie.

**Komponenty z Figmy (instancje, nie jednorazowe ramki):**

- Sidebar — 5 wariantów aktywnej pozycji,
- Tab bar — 4 warianty,
- Status / Badge — 9 wariantów,
- Button — Primary/Secondary × Default/Hover/Focus/Disabled/Loading,
- Preview — 5 komponentów marketingowych (kopie ekranów; synchronizacja ręczna).

Pliki wektorowe: `branding/detailflow-symbol.svg`, `detailflow-logo-dark.svg`, `detailflow-logo-light.svg`, `detailflow-logo-white.svg`.

---

## 5. Przepływy, które trzeba zaimplementować

### 5.1 Dzień pracy studia

```
Otwarcie pulpitu
  → KPI + plan boksów + „na warsztacie”
  → alerty (magazyn, serwis ceramiki, KSeF)
Nowe zlecenie / nowa wycena
  → klient + auto
  → usługi × mnożniki
  → termin w kalendarzu
  → wysyłka wyceny (e-mail/SMS + link portalu)
Klient akceptuje
  → status wyceny = zaakceptowana
  → rezerwacja boksu
Praca
  → zmiana etapu (mobile: „Zakończ: Korekta lakieru”)
  → zdjęcia przed / w trakcie / po
Odbiór
  → status Do odbioru → Zakończone
  → dopiero wtedy: wystawienie faktury
Faktura
  → nabywca (NIP / osoba)
  → pozycje z zlecenia
  → podgląd → KSeF TEST/PROD
  → UPO + numer KSeF + PDF do klienta
  → oznacz jako opłaconą (przelew; Stripe Checkout opcjonalnie później)
```

### 5.2 Numeracja i dane demonstracyjne (kontrakt spójności)

Te reguły z prototypu stają się **testami akceptacyjnymi**:

- Zlecenia: `#DF-0248` (w trakcie, etap 2/4, Porsche, Adam Nowak).
- Faktura `FV/41/10/2026` **nie jest fakturą za #DF-0248**. Powstaje z zakończonego `#DF-0243` z 23.10.2026.
- Faktury wystawia się **po zakończeniu zlecenia**.
- Wystawienie FV/41: 24.10, 10:12:08; przyjęcie testowe: 10:13:08; czas do przyjęcia: 60 s.
- Kwota po terminie (demo): 3 450 zł. Wszystkie nieopłacone: 8 250 zł (z FV/41).
- Portal: 3 etapy, nie 4.
- Klienci: 20 / stronę, paginacja.
- Aktywne ≠ zakończone. W pulpicie po audycie aktywne = 7 (3 w trakcie, 2 do odbioru, 2 przyjęte).

### 5.3 Wycena — silnik ceny

```
cena_brutto = sum(cena_bazowa_usługi) × mnożnik_rozmiaru × mnożnik_lakieru
VAT 23% wliczony w brutto (kwota VAT liczona od brutto: VAT = brutto × 23/123)
```

Przykład z D-06: 4 000 zł × 1,20 × 1,00 = **4 800 zł** brutto; VAT 897,56 zł.

Rozmiary: Małe ×1,0 · Średnie ×1,2 · SUV ×1,35.  
Zmiana rozmiaru **przelicza cenę i czas**. Krok 3 (termin i potwierdzenie wysyłki) jest w prototypie niedokończony — we wdrożeniu trzeba go zbudować.

### 5.4 KSeF — przepływ v1

Środowisko **TEST i PRODUKCJA nigdy nie mieszają mianowników**. W UI zawsze znacznik `TEST` albo `PROD`.

v1: **sesja online**, kolejka, retry, historia zdarzeń jak na D-09:

1. Walidacja XSD FA(3)
2. Wysłanie (ref sesji)
3. Timeout / sprawdzenie statusu
4. Przetwarzanie
5. Przyjęcie + numer KSeF + UPO (XML)
6. PDF dla klienta z datą wysyłki; kolejna akcja = **„Wyślij ponownie”**

**Poza v1:** tryb offline KSeF. Nie pokazywać go jako włączalnej opcji. Przed ewentualnym v2: weryfikacja zasad MF i osobny dialog prawny.

Korekta: osobny dokument powiązany z fakturą źródłową (`Wystaw korektę`).

### 5.5 Billing platformy (Stripe), nie mylić z fakturami studia

Dwa niezależne obiegi pieniędzy:

| Obieg | Kto płaci | Mechanizm | Dokument |
| --- | --- | --- | --- |
| Abonament Detailflow | studio → Detailflow | Stripe Billing, PLN, miesięcznie | faktura VAT Detailflow (osobny temat księgowy) |
| Usługa detailingu | klient studia → studio | przelew / gotówka / później płatność online | **faktura KSeF studia** |

MRR w panelu właściciela = suma **aktywnych** abonamentów Solo/Studio/Pro. **Wyklucza** triale, zaległości i konta wstrzymane. Nie jest sumą wpłat Stripe w miesiącu (te są osobną metryką „Wpływy”).

Definicje metryk z A-01/A-04/A-05 są wiążące — patrz `audit/admin/README.md`. Przykład: konwersja trialu = `płatne / zakończone triale`, nie `/ bieżące triale`.

Statusy konta studia:

`trial` → `active` → `past_due` → `suspended` / `canceled`

14 dni trialu **bez karty** (zgodne z landingiem). Po trialu: Checkout Stripe albo utrata dostępu z zachowaniem danych.

---

## 6. Zakres v1 vs później

### 6.1 Wchodzi do v1 (MVP wdrożeniowe)

- Auth studia (e-mail + magiczny link / hasło), zaproszenia pracowników, role.
- Multi-tenant: każde studio izolowane `studioId`.
- Pulpit, kalendarz boksów, zlecenia (tablica + karta), klienci i auta.
- Wyceny 3 kroki, w tym brakujące w Figmie krok 1 i 3.
- Portal klienta: status, wygasły link, **akceptacja wyceny**.
- Faktury: lista, kreator (krok 1 nabywca + krok 3 podgląd), szczegóły, KSeF TEST, PDF, korekta, „oznacz opłaconą”.
- Mobile pracownika dla D-odpowiedników M-01–M-08.
- Landing + rejestracja trialu.
- Stripe: produkty Solo/Studio/Pro, trial, webhooki, Customer Portal, past_due, zawieszenie.
- Panel właściciela A-01–A-10 (desktop).
- Import klientów CSV/Excel.
- E-mail transakcyjny PL (wycena, link portalu, faktura, trial).
- Wyszukiwanie ⌘K w obrębie studia.
- Audyt sesji wsparcia i zmian billingowych.

### 6.2 Do zaprojektowania, ale budujemy w v1 (luki Figmy)

Prototyp wprost to oznacza:

- Wycena: krok 1 klient/auto, krok 3 termin + podgląd + potwierdzenie wysyłki.
- Faktura: krok 1 nabywca, krok 3 podgląd i potwierdzenie wysyłki.
- Osobne zakładki zlecenia: Zdjęcia, Stan auta, Historia (dziś są w przeglądzie).
- Portal: ekran akceptacji wyceny i potwierdzenie decyzji.
- Mobilne rozszerzone opcje wyceny.

### 6.3 Poza v1

- Usługi i cennik jako pełny CMS (w v1: seed + prosta edycja w wycenie wystarczy).
- Magazyn (alert CarPro w pulpicie może być **statycznym/ręcznym** alertem albo minimalnym progiem SKU — pełny magazyn później).
- Statystyki zaawansowane, Portfolio, pełne Ustawienia i Konto.
- KSeF offline.
- Panel właściciela na mobile.
- Płatność klienta online za usługę (Stripe Checkout B2C) — można dodać po v1.
- Abonament roczny.
- Tryb jasny (produkt jest ciemny).

---

## 7. Architektura docelowa

```
                    ┌────────────┐
   detailflow.pl    │  Next.js   │  App Router
   app.detailflow.pl│  (web)     │  RSC + Route Handlers
   admin. /app/admin│            │
                    └─────┬──────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
     PostgreSQL      Redis/BullMQ     Object storage
     (Prisma)        (KSeF, mail,     (zdjęcia zleceń,
                     webhooks)         PDF, UPO XML)
           ▲
           │
     worker.js  ── KSeF 2.0 API ── MF TEST / PROD
                ── Stripe webhooks (idempotentnie)
                ── e-mail / SMS
```

**Monolit modularny Next.js**, nie mikroserwisy. Worker w tym samym obrazie Docker (`node dist/worker.js`) albo drugi serwis Compose. Baza jedna, schemat z twardym `studioId`.

Routing (propozycja):

```
app/
  (marketing)/          ← landing, cennik, regulamin
  (auth)/               ← logowanie, trial, zaproszenia
  (studio)/             ← panel studia, layout z sidebar/tabbar
  p/[token]/            ← portal klienta, bez sesji studia
  (platform)/admin/     ← panel właściciela, osobna sesja + MFA
  api/
    stripe/webhook/
    ksef/               ← tylko wewnętrzne, nie publiczne
    cron/
    portal/
```

Hosty:

- `www.detailflow.pl` — marketing,
- `app.detailflow.pl` — studio + portal `/p/...`,
- opcjonalnie `admin.detailflow.pl` albo `/admin` za osobnym guardem.

---

## 8. Stack i dobór narzędzi

### 8.1 Stack narzucony (rdzeń)

| Warstwa | Wybór | Uzasadnienie |
| --- | --- | --- |
| Aplikacja | **Next.js 15** App Router, React 19, TypeScript strict | SSR landingu, RSC pulpitu, Route Handlers na webhooki Stripe/KSeF |
| ORM | **Prisma** + migracje | model relacyjny (studio–klient–auto–zlecenie–faktura) i typy TS |
| Baza | **PostgreSQL 16** | tenant isolation, JSONB na payload KSeF, pełny tekst, joby |
| Runtime | **Docker Compose** | powtarzalny dev i prod: web, worker, postgres, redis, minio |
| Billing SaaS | **Stripe Billing** | Solo/Studio/Pro, trial, retry, Customer Portal, webhooks |

### 8.2 Narzędzia, których warto użyć (rekomendacja)

| Potrzeba | Narzędzie | Dlaczego to, a nie coś innego |
| --- | --- | --- |
| UI | **Tailwind CSS** + tokeny `--df-*` + **Radix / shadcn** | szybkie 1:1 z Figmą, a11y focus, dark-first |
| Ikony | **Lucide** (jak w audycie sidebara) | spójne z makietą |
| Formularze | **React Hook Form + Zod + @hookform/resolvers** | wycena, faktura, zawieszenie konta |
| Paleta ⌘K | **cmdk** | topbar „Szukaj klienta, auta, zlecenia… ⌘K” |
| Tabele | **TanStack Table** | klienci 20/stronę, faktury, studia |
| Kalendarz zasobowy | własny widok (osie boksów) na **date-fns-tz** | FullCalendar źle kłamie w 2-boksowy dzień; makieta jest specyficzna |
| DnD Kanban | **@dnd-kit** | zmiana statusu zlecenia |
| Auth | **Auth.js v5** albo **Better Auth** | sesje w Postgres, magic link, zaproszenia; bez Clerk (Docker/self-host) |
| Hasła | **Argon2id** | jeśli credentials |
| MFA admina | **TOTP (otpauth)** + backup codes | wymagane w A-08 |
| Kolejki | **BullMQ + Redis** | KSeF poll, maile, Stripe retry, wygasanie linków |
| Pliki | **S3 API**: MinIO lokalnie, w prod **Cloudflare R2** albo MinIO | zdjęcia aut, PDF, UPO; nie Blob jako baza danych |
| Obrazy | **sharp** + podpisane URL | miniatury pulpitu i portalu |
| PDF faktury | **@react-pdf/renderer** albo Puppeteer na szablon FV | wygląd jak D-09, QR KSeF |
| XML FA(3) | generator z XSD MF + **libxmljs2** / xmllint w CI | nie składać XML string concatenation |
| KSeF | własny adapter na [API KSeF 2.0](https://api.ksef.mf.gov.pl/docs/v2) | oficjalne SDK MF jest Java/.NET; w Node piszemy cienki klient |
| E-mail | **Resend** albo SMTP (Mailgun) + **React Email** | PL szablony, podgląd w dev przez Mailpit |
| SMS | **SMSAPI** (Polska) | link wyceny / portal; koszt w A-04 |
| Stripe | **stripe** SDK + **Stripe CLI** do webhooków lokalnie | Checkout, Portal, Billing, Customer |
| Walidacja env | **@t3-oss/env-nextjs** | twarde padnięcie bez sekretów |
| Logi | **pino** | JSON w kontenerze |
| Błędy | **Sentry** | web + worker |
| E2E | **Playwright** | pulpit, wycena, portal, webhook Stripe (testy) |
| Unit | **Vitest** | silnik ceny, metryki MRR, parser KSeF |
| Dev proxy | **Caddy** w Compose | HTTPS lokalnie pod Stripe webhook |
| CI | GitHub Actions | `prisma migrate`, lint, test, build image |
| Backup | `pg_dump` cron + retencja R2 | obowiązek przy fakturach |

**Nie rekomendujemy na start:** Nest jako osobne API, GraphQL, Kafka, Elasticsearch, Clerk/Auth0 (utrudniają self-host), Prisma Data Proxy (zbędne przy Compose), trzymanie dynamicznych danych w Netlify Blobs / S3 JSON.

### 8.3 Hosting

Compose na VPS (Hetzner/OVH) za Caddy/Traefik jest zgodny z Dockerem i KSeF (stałe IP, certyfikaty, webhooki). Alternatywa: aplikacja na Fly.io/Railway + managed Postgres, nadal z workerem i Redis. Netlify dobrze serwuje landing, ale **webhook Stripe + worker KSeF + upload zdjęć** wygodniej trzymać w długożyjącym Node (Compose), nie w krótkich funkcjach.

---

## 9. Model danych (Prisma — szkic v1)

Izolacja: **każda tabela operacyjna ma `studioId`**. Zapytania studia zawsze przez `where: { studioId: session.studioId }`. Panel platformy omija ten filtr, ale loguje dostęp.

Szkic koncepcyjny (dostosować do wersji Prisma w repo; źródłem prawdy są migracje, nie `db push` na produkcji):

```prisma
enum StudioStatus { trial active past_due suspended canceled }
enum Plan { solo studio pro }
enum MembershipRole { owner manager worker }
enum OrderStatus { accepted in_progress ready_for_pickup completed canceled }
enum QuoteStatus { draft sent accepted rejected expired }
enum InvoiceStatus { draft sent ksef_pending ksef_accepted ksef_rejected unpaid paid canceled }
enum KsefEnv { test production }

model Studio {
  id                   String        @id @default(cuid())
  publicCode           String        @unique // ST-00128
  name                 String
  slug                 String        @unique
  city                 String?
  address              String?
  nip                  String?
  status               StudioStatus  @default(trial)
  plan                 Plan          @default(solo)
  trialEndsAt          DateTime?
  stripeCustomerId     String?       @unique
  stripeSubscriptionId String?       @unique
  ksefEnv              KsefEnv       @default(test)
  ksefTokenEnc         String?       // szyfr at rest
  createdAt            DateTime      @default(now())
  members              Membership[]
  clients              Client[]
  vehicles             Vehicle[]
  bays                 Bay[]
  orders               WorkOrder[]
  quotes               Quote[]
  invoices             Invoice[]
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String
  passwordHash String?
  memberships  Membership[]
}

model Membership {
  id       String         @id @default(cuid())
  studioId String
  userId   String
  role     MembershipRole
  studio   Studio         @relation(fields: [studioId], references: [id])
  user     User           @relation(fields: [userId], references: [id])
  @@unique([studioId, userId])
}

model Client {
  id        String   @id @default(cuid())
  studioId  String
  name      String
  email     String?
  phone     String?
  street    String?
  city      String?
  postal    String?
  nip       String?  // nabywca B2B
  isRegular Boolean  @default(false)
}

model Vehicle {
  id           String  @id @default(cuid())
  studioId     String
  clientId     String
  make         String
  model        String
  plate        String
  year         Int?
  color        String?
  size         String  // small | medium | suv
}

model Bay {
  id       String @id @default(cuid())
  studioId String
  name     String // Boks 01
  sort     Int
}

model WorkOrder {
  id            String      @id @default(cuid())
  studioId      String
  number        String      // DF-0248
  clientId      String
  vehicleId     String
  bayId         String?
  status        OrderStatus
  stage         Int         @default(1) // 1–4
  scheduledFrom DateTime
  scheduledTo   DateTime
  dueAt         DateTime?
  totalGross    Decimal     @db.Decimal(12, 2)
  quoteId       String?
  @@unique([studioId, number])
}

model Quote {
  id         String      @id @default(cuid())
  studioId   String
  status     QuoteStatus
  sizeMult   Decimal     @db.Decimal(4, 2)
  paintMult  Decimal     @db.Decimal(4, 2)
  totalGross Decimal     @db.Decimal(12, 2)
  vatAmount  Decimal     @db.Decimal(12, 2)
  notes      String?
  sentAt     DateTime?
  decidedAt  DateTime?
  items      QuoteItem[]
}

model Invoice {
  id            String        @id @default(cuid())
  studioId      String
  number        String        // FV/41/10/2026
  workOrderId   String
  status        InvoiceStatus
  ksefEnv       KsefEnv
  ksefNumber    String?
  ksefUpoXml    String?
  issuedAt      DateTime
  saleAt        DateTime
  dueAt         DateTime
  paidAt        DateTime?
  totalNet      Decimal       @db.Decimal(12, 2)
  totalVat      Decimal       @db.Decimal(12, 2)
  totalGross    Decimal       @db.Decimal(12, 2)
  events        KsefEvent[]
  @@unique([studioId, number])
}

model PortalLink {
  id          String    @id @default(cuid())
  studioId    String
  workOrderId String
  tokenHash   String    @unique
  expiresAt   DateTime
  revokedAt   DateTime?
}

model StripeEvent {
  id          String   @id // evt_...
  type        String
  processedAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  studioId  String?
  action    String
  meta      Json
  createdAt DateTime @default(now())
}
```

Dodatkowo: `ServiceCatalog`, `OrderPhoto`, `IntakeProtocol` (punkty uszkodzeń), `CoatingReminder`, `SupportTicket`, `SupportSession`, `PlatformUser`, `FeatureFlag`, `ProcessedJob`.

Indeksy obowiązkowe: `(studioId, status)`, `(studioId, createdAt)`, `plate`, `ksefNumber`, `stripeCustomerId`.

**Pieniądze:** zawsze `Decimal`, nigdy `Float`. Waluta **PLN**. Kwoty abonamentów w panelu platformy są **netto**.

---

## 10. Multi-tenant, bezpieczeństwo, RODO

1. **Tenant guard** w warstwie zapytań (helper `studioDb(studioId)`), nie „pamiętaj dodać where”.
2. Portal klienta: token w URL jest **hashowany w bazie**, surowy token tylko w linku, TTL np. 14–30 dni, P-02 na wygaśnięcie.
3. Zdjęcia: bucket prywatny, URL podpisany, osobny prefix per `studioId`.
4. Token KSeF i klucze Stripe: **szyfrowanie at rest** (KMS albo `libsodium` + klucz z env).
5. Webhook Stripe: surowe body, weryfikacja podpisu, **idempotencja** po `event.id`.
6. Admin: MFA, sesja wsparcia 15 min, każdy podgląd w `AuditLog`.
7. Zawieszenie konta (A-10): przycisk nieaktywny, dopóki operator nie wpisze nazwy studia i powodu.
8. RODO: umowa powierzenia z studiem, retencja zdjęć, eksport/usunięcie klienta, logi dostępu.
9. KSeF TEST nie może „przypadkiem” iść na PROD — osobne sekrety, twardy feature flag, badge w UI.
10. Hasła reset, lockout, CSRF na Server Actions, `Content-Security-Policy`.

### 10.1 Retencja zdjęć

Zdjęcia zlecenia (`OrderPhoto`) mogą zawierać tablice rejestracyjne i otoczenie. To dane osobowe.

- Bucket jest prywatny. Odczyt tylko przez podpisany URL ważny 5 minut. Klucz ma prefix `studios/<studioId>/orders/<workOrderId>/`.
- Niepotwierdzony upload (`uploadedAt` puste) nie jest na liście. Plik o innym rozmiarze lub typie jest usuwany z bucketu razem z wierszem.
- Zdjęcie zostaje przez czas życia zlecenia, bo protokół przyjęcia i reklamacja potrzebują dowodu stanu auta. v1 nie kasuje automatycznie zdjęć zakończonych zleceń. Długość takiego kasowania (np. po przedawnieniu reklamacji) jest decyzją prawną i nie wchodzi w to wydanie.
- Cascade w Postgresie usuwa wiersz, nie obiekt S3. Ścieżka odrzuconego uploadu woła `deleteObject`. Przy usuwaniu danych studia trzeba skasować prefix `studios/<studioId>/`.
- Portal nie pokazuje zdjęcia bez ważnego tokenu. Surowy token nie trafia do logów.
- Klienta bez zleceń i wycen można usunąć. Klienta z historią nie usuwamy, bo faktury i protokół zostają.

---

## 11. Stripe — implementacja

Produkty (test + live, te same `lookup_key`):

| Plan | Netto / mies. | Stripe |
| --- | --- | --- |
| Solo | 79 PLN | `plan_solo_monthly` |
| Studio | 149 PLN | `plan_studio_monthly` |
| Pro | 279 PLN | `plan_pro_monthly` |

Zdarzenia, które **muszą** aktualizować `Studio`:

- `checkout.session.completed`
- `customer.subscription.created|updated|deleted`
- `invoice.paid`
- `invoice.payment_failed` → `past_due`, kolejka retry, karta w A-04
- `customer.subscription.paused` / unpaid → ścieżka zawieszenia

Customer Portal Stripe obsługuje zmianę planu i karty. Aplikacja **nie** jest źródłem prawdy o pieniądzu — Stripe jest, Postgres trzyma kopię do autoryzacji dostępu (`status`, `plan`).

Trial 14 dni bez karty: rejestracja tworzy `Studio` + `trialEndsAt`. Cron codziennie: 3 dni przed końcem mail; po końcu `restricted` aż do Checkout.

Mapowanie na makietę A-04:

- MRR = suma cen aktywnych subskrypcji (nie triale, nie past_due, nie suspended).
- Wpływy = `invoice.paid` w okresie.
- Zaległości = `past_due` × cena planu.
- Churn = anulowane w okresie / baza na starcie okresu.

---

## 12. Docker — lokalnie i produkcja

Minimalny `docker-compose.yml`:

```yaml
services:
  web:
    build: .
    command: pnpm dev
    ports: ["3000:3000"]
    env_file: .env
    depends_on: [postgres, redis, minio]
  worker:
    build: .
    command: pnpm worker
    env_file: .env
    depends_on: [postgres, redis]
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: detailflow
      POSTGRES_PASSWORD: detailflow
      POSTGRES_DB: detailflow
    volumes: [pgdata:/var/lib/postgresql/data]
    ports: ["5432:5432"]
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
  mailpit:
    image: axllent/mailpit
    ports: ["8025:8025"]
volumes:
  pgdata:
```

Obraz produkcyjny: `output: "standalone"` w Next.js, user non-root, healthcheck `/api/health`, `prisma migrate deploy` w entrypoincie **zanim** wstanie web. Worker i web tej samej wersji obrazu.

Zmienne (nie commitujemy `.env`):

```
DATABASE_URL=
REDIS_URL=
S3_ENDPOINT= S3_BUCKET= S3_ACCESS_KEY= S3_SECRET_KEY=
AUTH_SECRET=
STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET= NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
KSEF_ENV=test
KSEF_API_URL=https://api-test.ksef.mf.gov.pl
KSEF_TOKEN_ENCRYPTION_KEY=
RESEND_API_KEY= EMAIL_FROM=
SMSAPI_TOKEN=
SENTRY_DSN=
APP_URL=https://app.detailflow.pl
```

---

## 13. Mapowanie ekranów na trasy

| Ekran | Trasa |
| --- | --- |
| L-01/L-02 | `/` |
| Cennik | `/#pricing` lub `/pricing` |
| Trial | `/start` |
| Logowanie | `/login` |
| D-01 | `/` (po sesji studia) |
| D-02 | `/calendar` |
| D-03 | `/orders` |
| D-04 | `/orders/[number]` |
| D-05 | `/customers`, `/customers/[id]` |
| D-06 | `/quotes/new` |
| D-07–D-10 | `/invoices`, `/invoices/new`, `/invoices/[number]`, `/invoices/attention` |
| M-* | te same trasy, layout mobilny |
| P-01/P-02 | `/p/[token]` |
| A-01–A-08 | `/admin`, `/admin/studios`, `/admin/subscriptions`, … |
| A-09/A-10 | dialogi na karcie studia |

---

## 14. Plan wdrożenia (kolejność prac)

Budować **pionami wartości**, nie warstwami technicznymi „najpierw cały admin”.

### Faza 0 — fundament (tydzień 1)

- repo Next.js + Prisma + Compose + tokeny CSS + layout sidebara/tab baru,
- Auth, model Studio/User/Membership,
- seed Obsidian Studio (dane z makiety — te same numery, żeby porównać UI 1:1),
- healthcheck, env, CI.

### Faza 1 — operacje (tygodnie 2–4)

- Klienci i auta + import CSV,
- Zlecenia Kanban + karta + 4 etapy,
- Kalendarz boksów,
- Pulpit KPI,
- Zdjęcia + protokół przyjęcia,
- Mobile M-01–M-04.

**Definition of done:** pracownik może przyjąć auto, przesunąć etapy, wstawić zdjęcia i zobaczyć dzień na pulpicie.

### Faza 2 — pieniądz studia (tygodnie 5–7)

- Katalog usług + silnik wyceny + wizard 3 kroków,
- Portal klienta + akceptacja wyceny + wygasły link,
- Faktury + PDF,
- Adapter KSeF TEST: sesja, poll, UPO, historia jak D-09,
- Alert odrzuceń na pulpicie.

**DoD:** ścieżka wycena → akceptacja → praca → FV TEST z numerem KSeF.

### Faza 3 — SaaS (tygodnie 8–9)

- Landing + trial 14 dni bez karty,
- Stripe plany, webhooki, portal klienta Stripe,
- Ograniczenie dostępu po trialu / past_due,
- Maile (trial, wycena, FV, link).

### Faza 4 — platforma (tydzień 10–11)

- Panel A-01–A-10 na prawdziwych agregatach (definicje z `audit/admin/README.md`),
- Wsparcie + sesja 15 min + audyt,
- Flagi FEATURE, eksport CSV.

### Faza 5 — twardnienie (tydzień 12)

- KSeF PROD za flagą per studio,
- Playwright na złote ścieżki,
- backup, monitoring, Sentry, load na upload zdjęć,
- regulamin, RODO, cennik zatwierdzony prawnie.

---

## 15. Testy akceptacyjne (wybrane)

1. Seed pulpitu zgadza się z D-01 po audycie: 7 aktywnych, Porsche etap 2/4, alert ceramiki.
2. FV/41 nie powstaje z #DF-0248.
3. 4 000 × 1,2 × 1,0 = 4 800,00; VAT 897,56.
4. Portal pokazuje 3 etapy, nie 4.
5. Wygasły token → P-02, nie 500.
6. Webhook `invoice.payment_failed` ustawia `past_due` i pojawia się w A-04.
7. MRR nie dolicza trialu ani past_due.
8. KSeF TEST i PROD mają osobne liczniki; UI nie pozwala wysłać TEST-owym tokenem na PROD.
9. Sesja wsparcia wygasa po 15 min i jest w audycie.
10. A-10: pusta nazwa = przycisk nieaktywny; zła nazwa = błąd; poprawna = suspend + odcięcie logowania studia.
11. `prefers-reduced-motion: reduce` wyłącza puls skeletonów.
12. Lista klientów: 20 wierszy, strona 2 nie miesza tenantów.

---

## 16. Ryzyka i decyzje otwarte

| Ryzyko | Wpływ | Co zrobić przed kodem |
| --- | --- | --- |
| Obowiązek KSeF zależy od progów podatnika i dat 2026/2027 | prawny | studio samo oznacza env; my nie twierdzimy, że „każdy musi” |
| FA(3) i changelog API MF | integracja | pin wersji XSD, testy kontraktu, środowisko `api-test` |
| Stripe Invoice ≠ KSeF | księgowość Detailflow | osobna ścieżka na FV za abonament (biuro rachunkowe / KSeF operatora) |
| Zdjęcia aut to dane biometryczno-podobne / tablice | RODO | umowa, retencja, dostęp portalowy tylko przez token |
| Landing obiecuje import, KSeF, brak karty | produkt | albo w v1, albo usunąć z L-01 |
| Magazyn i cennik w menu | UX | „Wkrótce”, nie 404 |
| Brak kroków 1 i 3 wyceny/faktury w Figmie | UI | zaprojektować w kodzie wg wizardu kroku 2 |
| Kalkulator i opinie | marketing | nie publikować fikcji |

Decyzje do potwierdzenia ze stakeholderem:

1. Czy v1 robi KSeF tylko TEST, a PROD w sprincie osobnym?
2. Czy płatność klienta za detailing jest przelewem ręcznym (v1), czy Stripe Checkout?
3. Limity planów (ile użytkowników / boksów / faktur)? Makieta A-03 ma limity — trzeba je spisać.
4. SMS od startu czy tylko e-mail?
5. Czy jeden człowiek może należeć do wielu studiów (picker w sidebarze sugeruje, że tak)?

---

## 17. Źródła w tym repozytorium

| Plik | Po co |
| --- | --- |
| [Figma](https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S) | źródło prawdy UI |
| `file-structure.md` | mapa stron, zakres, dane demo |
| `audit/admin/README.md` | definicje MRR i panel operatora |
| `audit/admin/*.png` | zrzuty A-01–A-10 |
| `branding/*.svg` | logo Flowcut |
| `dashboard.png`, `audit/invoice.png`, `audit/quote.png`, `audit/mobile.png` | referencje 1:1 |
| `build-design.js`, `more-*.js` | logika ekranów i copy |

---

## 18. Kryterium „wdrożone”

Produkt jest wdrożony, gdy:

1. Nowe studio kończy trial i płaci Stripe za plan Studio.
2. Pracownik na telefonie prowadzi dzień (etapy + zdjęcia).
3. Klient otwiera link, akceptuje wycenę i widzi termin odbioru.
4. Po zakończeniu zlecenia studio wystawia FV, dostaje numer KSeF TEST i PDF.
5. Operator w A-01 widzi prawdziwy MRR i kolejkę past_due, a nie dane z makiety.
6. TEST i PROD KSeF są rozdzielone, sekrety nie są w git, Compose wstaje jednym `docker compose up`.

Do tego momentu makieta pozostaje **specyfikacją wizualną i dziedzinową**, a ten dokument — **specyfikacją implementacji**.
