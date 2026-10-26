#!/usr/bin/env python3
"""Jednorazowy seed backlogu Detailflow. Przerywa, gdy repo ma już issue."""
from __future__ import annotations

import json
import subprocess
import sys

REPO = "mikolajjedrzejczak/detailflow"
FIGMA = "https://www.figma.com/design/3pssHgZjGzo0UeyBC8yZ3S"
DOCS = "docs/dokumentacja-wdrozenia.md"


def run(args: list[str], input_text: str | None = None) -> str:
    r = subprocess.run(
        args,
        input=input_text,
        text=True,
        capture_output=True,
        check=False,
    )
    if r.returncode != 0:
        raise SystemExit(f"$ {' '.join(args)}\n{r.stderr.strip() or r.stdout.strip()}")
    return r.stdout.strip()


def gh(*args: str, input_text: str | None = None) -> str:
    return run(["gh", *args], input_text)


def figma(node: str, label: str) -> str:
    return f"[{label}]({FIGMA}?node-id={node.replace(':', '-')})"


def body(**parts: str) -> str:
    order = [
        "Dla kogo",
        "Kontekst",
        "Cel",
        "Figma",
        "Dokumentacja",
        "Zakres",
        "Poza zakresem",
        "Kryteria akceptacji",
        "Wskazówki",
        "Pliki docelowe",
        "Zależności",
        "Testy",
        "Issue składowe",
        "Wynik epika",
    ]
    chunks = []
    for title in order:
        key = title
        if key in parts and parts[key].strip():
            chunks.append(f"## {title}\n\n{parts[key].strip()}")
    return "\n\n".join(chunks) + "\n"


LABELS = [
    ("type:epic", "6F42C1", "Duży moduł. Nie zamykać jednym PR-em."),
    ("type:ui", "0E7C3A", "Ekran lub komponent 1:1 z Figmy."),
    ("type:implement", "1D4ED8", "Model, API, worker, integracja."),
    ("type:infra", "111827", "Compose, CI, hosting, obserwowalność."),
    ("type:docs", "0075CA", "Dokumentacja."),
    ("layer:ui", "6B8F00", "Zmiana w interfejsie."),
    ("layer:api", "0969DA", "Route Handlers / Server Actions."),
    ("layer:data", "9A6700", "Prisma / Postgres."),
    ("layer:worker", "BC4C00", "Kolejka, cron, KSeF poll."),
    ("area:foundation", "8B949E", "Szkielet repo."),
    ("area:design-system", "D3F66A", "Tokeny i komponenty."),
    ("area:auth", "8B5CF6", "Auth i tenancy."),
    ("area:pulpit", "238636", "D-01."),
    ("area:kalendarz", "1F6FEB", "D-02 / M-02."),
    ("area:zlecenia", "A371F7", "D-03 D-04 / M-03 M-04."),
    ("area:klienci", "2DA44E", "D-05."),
    ("area:wyceny", "D4A72C", "D-06 / M-05."),
    ("area:portal", "388BFD", "P-01 P-02."),
    ("area:faktury", "CF222E", "D-07–D-10."),
    ("area:ksef", "9A1818", "KSeF 2.0 FA(3)."),
    ("area:mobile", "FB8500", "M-01–M-08."),
    ("area:landing", "3FB950", "L-01–L-03."),
    ("area:billing", "635BFF", "Stripe SaaS."),
    ("area:admin", "21262D", "A-01–A-10."),
    ("phase:0", "8B949E", "Fundament."),
    ("phase:1", "1F6FEB", "Operacje studia."),
    ("phase:2", "D4A72C", "Wyceny, portal, KSeF."),
    ("phase:3", "A371F7", "Landing i Stripe."),
    ("phase:4", "CF222E", "Panel platformy."),
    ("phase:5", "111827", "Twardnienie."),
    ("size:S", "C9D1D9", "Małe."),
    ("size:M", "8B949E", "Średnie."),
    ("size:L", "6E7681", "Duże."),
    ("agent-ready", "0E8A16", "Wystarczy kontekstu, by zacząć."),
    ("blocked", "D1242F", "Czeka na zależność."),
]

MILESTONES = [
    ("Faza 0 — Fundament", "Next.js, Compose, Prisma, tokeny, auth, seed Obsidian Studio."),
    ("Faza 1 — Operacje", "Klienci, zlecenia, kalendarz, pulpit, zdjęcia, mobile hali."),
    ("Faza 2 — Pieniądz studia", "Wyceny, portal klienta, faktury, KSeF TEST."),
    ("Faza 3 — SaaS", "Landing, trial 14 dni, Stripe, maile."),
    ("Faza 4 — Platforma", "Panel właściciela A-01–A-10 na prawdziwych danych."),
    ("Faza 5 — Twardnienie", "Playwright, Sentry, backup, KSeF PROD, RODO."),
]


def epic(key, title, milestone, area, **parts):
    return {
        "key": key,
        "kind": "epic",
        "title": title,
        "milestone": milestone,
        "labels": ["type:epic", area, milestone_phase(milestone), "size:L"],
        "body": body(**parts),
    }


def issue(key, title, kind, milestone, labels, **parts):
    extra = ["agent-ready", milestone_phase(milestone), *labels]
    if kind == "ui":
        extra = ["type:ui", "layer:ui", *extra]
    elif kind == "implement":
        extra = ["type:implement", *extra]
    elif kind == "infra":
        extra = ["type:infra", *extra]
    return {
        "key": key,
        "kind": kind,
        "title": title,
        "milestone": milestone,
        "labels": extra,
        "body": body(**parts),
        "epic": parts.get("epic_key", ""),
    }


def milestone_phase(name: str) -> str:
    return {
        "Faza 0 — Fundament": "phase:0",
        "Faza 1 — Operacje": "phase:1",
        "Faza 2 — Pieniądz studia": "phase:2",
        "Faza 3 — SaaS": "phase:3",
        "Faza 4 — Platforma": "phase:4",
        "Faza 5 — Twardnienie": "phase:5",
    }[name]


RULES = """- `studioId` na każdym zapytaniu operacyjnym.
- Stripe ≠ KSeF. Kwoty `Decimal` / PLN.
- TEST i PROD KSeF rozdzielone.
- Poza v1: magazyn, statystyki, portfolio, KSeF offline, rok w Stripe."""

EPICS = [
    epic(
        "E0",
        "[Epic] Fundament: Next.js, Docker, Prisma, seed",
        "Faza 0 — Fundament",
        "area:foundation",
        **{
            "Dla kogo": "Zespół i agenty. Najpierw ten epik, potem UI.",
            "Wynik epika": "`docker compose up` wstaje web + postgres + redis + minio. Migracje, seed Obsidian Studio, `/api/health`.",
            "Figma": f"{figma('96:2', 'Okładka')} — tylko kontekst produktu, nie ekran do kodowania.",
            "Dokumentacja": f"{DOCS} §7–9, §12, §14 Faza 0.",
            "Poza zakresem": "Ekrany produktu, Stripe, KSeF.",
        },
    ),
    epic(
        "E1",
        "[Epic] Design system i szkielet aplikacji studia",
        "Faza 0 — Fundament",
        "area:design-system",
        **{
            "Wynik epika": "Tokeny `--df-*`, logo Flowcut, sidebar, topbar, tab bar, badge, button — instancje jak w Figmie.",
            "Figma": f"{figma('93:2732', '01 Brand i komponenty')} · {figma('92:2384', 'Sidebar')} · {figma('92:3346', 'Tab bar')} · {figma('92:3540', 'Status')} · {figma('82:728', 'Button')}",
            "Dokumentacja": f"{DOCS} §4.7.",
        },
    ),
    epic(
        "E2",
        "[Epic] Auth, trial 14 dni i multi-tenant",
        "Faza 0 — Fundament",
        "area:auth",
        **{
            "Wynik epika": "Rejestracja studia bez karty, sesja, role owner/manager/worker, twardy tenant guard.",
            "Figma": "Picker studia w sidebarze (Obsidian Studio). Brak osobnego ekranu logowania w makiecie — zaprojektuj minimalnie w tokenach Detailflow.",
            "Dokumentacja": f"{DOCS} §3, §10, §11 (trial).",
        },
    ),
    epic(
        "E3",
        "[Epic] Pulpit studia (D-01)",
        "Faza 1 — Operacje",
        "area:pulpit",
        **{
            "Wynik epika": "Dzień pracy: KPI, mini-plan boksów, zlecenia dziś, auto na warsztacie, alerty.",
            "Figma": f"{figma('1:3', 'D-01 Pulpit')} (strona {figma('93:2733', '02 Desktop')})",
            "Dokumentacja": f"{DOCS} §4.2, §5.1, §15 pkt 1.",
        },
    ),
    epic(
        "E4",
        "[Epic] Kalendarz boksów (D-02)",
        "Faza 1 — Operacje",
        "area:kalendarz",
        **{
            "Wynik epika": "Widok dzień: Boks 01/02 × 08:00–18:00, linia teraz, kolizje niemożliwe.",
            "Figma": f"{figma('5:10', 'D-02 Kalendarz')}",
            "Dokumentacja": f"{DOCS} §4.2 D-02, §8.2 kalendarz własny (nie FullCalendar).",
        },
    ),
    epic(
        "E5",
        "[Epic] Zlecenia: Kanban, karta, zdjęcia, protokół",
        "Faza 1 — Operacje",
        "area:zlecenia",
        **{
            "Wynik epika": "Przyjęte → W trakcie → Do odbioru → Zakończone. Karta #DF-0248 z 4 etapami, zdjęciami i protokołem przyjęcia.",
            "Figma": f"{figma('5:11', 'D-03 Tablica')} · {figma('5:12', 'D-04 Szczegóły')}",
            "Dokumentacja": f"{DOCS} §5.1–5.2. Faktury dopiero po zakończeniu.",
        },
    ),
    epic(
        "E6",
        "[Epic] Klienci i auta (D-05)",
        "Faza 1 — Operacje",
        "area:klienci",
        **{
            "Wynik epika": "Lista 20/stronę, karta klienta, auta, historia, import CSV.",
            "Figma": f"{figma('5:13', 'D-05 Klienci')}",
            "Dokumentacja": f"{DOCS} §4.2 D-05, lista 20 wierszy / 124 klientów w seedzie.",
        },
    ),
    epic(
        "E7",
        "[Epic] Wyceny i silnik ceny (D-06)",
        "Faza 2 — Pieniądz studia",
        "area:wyceny",
        **{
            "Wynik epika": "Wizard 3 kroków. 4000 × 1,20 × 1,00 = 4800 zł brutto, VAT 897,56 zł.",
            "Figma": f"{figma('5:14', 'D-06 krok 2')}. Kroki 1 i 3 nie są w Figmie — zbuduj analogicznie.",
            "Dokumentacja": f"{DOCS} §5.3, `file-structure.md` „Do zaprojektowania”.",
        },
    ),
    epic(
        "E8",
        "[Epic] Portal klienta (P-01, P-02, akceptacja)",
        "Faza 2 — Pieniądz studia",
        "area:portal",
        **{
            "Wynik epika": "Link bez konta, 3 etapy, wygasły token, decyzja o wycenie.",
            "Figma": f"{figma('93:2735', '04 Portal klienta')}",
            "Dokumentacja": f"{DOCS} §4.4, §10 pkt 2. Branding = logo + nazwa studia, nie wordmark Detailflow.",
        },
    ),
    epic(
        "E9",
        "[Epic] Faktury i KSeF TEST (D-07–D-10)",
        "Faza 2 — Pieniądz studia",
        "area:faktury",
        **{
            "Wynik epika": "FV po zakończonym zleceniu, podgląd, kolejka TEST, UPO, PDF, korekta. FV/41 ≠ #DF-0248.",
            "Figma": f"{figma('22:258', 'D-07')} · {figma('22:449', 'D-08')} · {figma('22:640', 'D-09')} · {figma('22:831', 'D-10')}",
            "Dokumentacja": f"{DOCS} §5.2, §5.4, §11 (ostrzeżenie Stripe ≠ KSeF).",
            "Poza zakresem": "KSeF offline, KSeF PROD (epik twardnienia), płatność Stripe za detailing.",
        },
    ),
    epic(
        "E10",
        "[Epic] Mobile pracownika (M-01–M-08)",
        "Faza 1 — Operacje",
        "area:mobile",
        **{
            "Wynik epika": "Te same trasy co desktop, tab bar, dzień hali na telefonie.",
            "Figma": f"{figma('93:2734', '03 Mobile')} · {figma('19:254', 'M-01')}",
            "Dokumentacja": f"{DOCS} §4.3. Panel właściciela nie ma mobile w v1.",
        },
    ),
    epic(
        "E11",
        "[Epic] Landing detailflow.pl (L-01–L-03)",
        "Faza 3 — SaaS",
        "area:landing",
        **{
            "Wynik epika": "Strona sprzedaży, cennik 79/149/279, CTA trial bez karty, bez fikcyjnych opinii.",
            "Figma": f"{figma('93:2737', '06 Landing')}",
            "Dokumentacja": f"{DOCS} §4.1, marketing w `file-structure.md`.",
        },
    ),
    epic(
        "E12",
        "[Epic] Stripe Billing platformy",
        "Faza 3 — SaaS",
        "area:billing",
        **{
            "Wynik epika": "Plany Solo/Studio/Pro, webhooki, Customer Portal, past_due, koniec trialu.",
            "Figma": f"{figma('119:477', 'A-04 Abonamenty')} — metryki, nie checkout.",
            "Dokumentacja": f"{DOCS} §5.5, §11.",
        },
    ),
    epic(
        "E13",
        "[Epic] Panel właściciela platformy (A-01–A-10)",
        "Faza 4 — Platforma",
        "area:admin",
        **{
            "Wynik epika": "Prawdziwe agregaty (nie mock). MFA. Sesja wsparcia 15 min. Zawieszenie z wpisaniem nazwy.",
            "Figma": f"{figma('116:10', '07 Panel')} · {figma('118:171', 'A-01')}",
            "Dokumentacja": f"{DOCS} §4.6 oraz `audit/admin/README.md` (definicje MRR obowiązują).",
        },
    ),
    epic(
        "E14",
        "[Epic] Twardnienie: testy, monitoring, KSeF PROD, RODO",
        "Faza 5 — Twardnienie",
        "area:foundation",
        **{
            "Wynik epika": "Złote ścieżki Playwright, Sentry, backup, flaga KSeF PROD per studio, checklista §18.",
            "Figma": "—",
            "Dokumentacja": f"{DOCS} §14 Faza 5, §15, §18.",
        },
    ),
]


def I(key, title, kind, milestone, labels, epic_key, **p):
    p["epic_key"] = epic_key
    if "Dla kogo" not in p:
        p["Dla kogo"] = (
            "Ludzie i agenty AI. Zrób **tylko to issue**. Epik jest kontekstem, nie zakresem PR."
        )
    p.setdefault("Wskazówki", RULES)
    p.setdefault("Dokumentacja", DOCS)
    item = issue(key, title, kind, milestone, labels, **p)
    item["epic"] = epic_key
    return item


ISSUES = [
    I(
        "0.1",
        "[Infra] Szkielet Next.js 15 + Docker Compose",
        "infra",
        "Faza 0 — Fundament",
        ["area:foundation", "size:L", "layer:api"],
        "E0",
        **{
            "Cel": "Puste app z TypeScript strict, Tailwind, `web`/`worker`/`postgres`/`redis`/`minio`/`mailpit`.",
            "Zakres": "- [ ] `pnpm` + App Router + `output: standalone` w Dockerfile\n- [ ] Compose jak w dokumentacji §12\n- [ ] `/api/health`\n- [ ] `.env.example` + `@t3-oss/env-nextjs`",
            "Poza zakresem": "Ekrany, Prisma modele biznesowe (osobne issue).",
            "Kryteria akceptacji": "- [ ] `docker compose up` bez ręcznych kroków poza skopiowaniem env\n- [ ] Health 200",
            "Pliki docelowe": "`package.json`, `Dockerfile`, `docker-compose.yml`, `app/api/health/route.ts`, `.env.example`",
        },
    ),
    I(
        "0.2",
        "[Impl] Prisma v1 + tenant helper + seed Obsidian Studio",
        "implement",
        "Faza 0 — Fundament",
        ["area:foundation", "layer:data", "size:L"],
        "E0",
        **{
            "Cel": "Schemat z dokumentacji §9, izolacja `studioId`, seed 1:1 z makietą.",
            "Zakres": "- [ ] Modele Studio, User, Membership, Client, Vehicle, Bay, WorkOrder, Quote, Invoice, PortalLink, StripeEvent, AuditLog\n- [ ] `studioDb(studioId)`\n- [ ] Seed: Obsidian Studio, Michał Kowalski, #DF-0248 etap 2/4, 7 aktywnych, FV/41 z #DF-0243 **nie** z 0248\n- [ ] Migracje, nie `db push` jako proces prod",
            "Kryteria akceptacji": "- [ ] Seed przechodzi dwukrotnie (idempotentny albo czysty reset)\n- [ ] Test: zapytanie bez studioId nie kompiluje się albo pada w helperze\n- [ ] FV/41 powiązana z #DF-0243",
            "Pliki docelowe": "`prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/db/tenant.ts`",
            "Zależności": "Po 0.1.",
            "Testy": "- [ ] Vitest helpera tenant\n- [ ] Asercje numerów demo z `file-structure.md`",
        },
    ),
    I(
        "0.3",
        "[Infra] CI: lint, typecheck, prisma validate",
        "infra",
        "Faza 0 — Fundament",
        ["area:foundation", "size:S"],
        "E0",
        **{
            "Cel": "PR nie wchodzi z czerwonym TypeScriptem.",
            "Zakres": "- [ ] GitHub Actions na push/PR\n- [ ] `pnpm lint`, `tsc`, `prisma validate`",
            "Kryteria akceptacji": "- [ ] Workflow zielony na `main` po szkielecie",
            "Pliki docelowe": "`.github/workflows/ci.yml`",
            "Zależności": "Po 0.1–0.2.",
        },
    ),
    I(
        "1.1",
        "[UI] Tokeny, typografia, logo Flowcut",
        "ui",
        "Faza 0 — Fundament",
        ["area:design-system", "size:M"],
        "E1",
        **{
            "Cel": "CSS 1:1 z Figmy. Wordmark Space Grotesk, UI Inter.",
            "Figma": f"{figma('93:2732', 'Brand')} · pliki `branding/detailflow-*.svg`",
            "Zakres": "- [ ] Zmienne `--df-bg` `#101214` … `--df-lime` `#D3F66A` (dokumentacja §4.7)\n- [ ] Inter + Space Grotesk\n- [ ] Logo dark/light/white/symbol",
            "Kryteria akceptacji": "- [ ] Sidebar na `#17191C`, akcja limonka, tekst `#F2F4F5`\n- [ ] Znak min. 16 px, w UI 24–32 px",
            "Pliki docelowe": "`app/globals.css`, `app/fonts.ts`, `components/brand/Logo.tsx`",
        },
    ),
    I(
        "1.2",
        "[UI] Primitives: Button, Badge, Input, focus",
        "ui",
        "Faza 0 — Fundament",
        ["area:design-system", "size:M"],
        "E1",
        **{
            "Cel": "10 stanów przycisku, 9 badge’y, focus 2+2 px.",
            "Figma": f"{figma('82:728', 'Button')} · {figma('92:3540', 'Status')} · {figma('81:756', 'S-02 interakcje')}",
            "Zakres": "- [ ] shadcn/Radix + tokeny\n- [ ] Primary/Secondary × default/hover/focus/disabled/loading\n- [ ] Badge: w trakcie, zaplanowane, do odbioru, zakończone, TEST, zaległość, błąd",
            "Kryteria akceptacji": "- [ ] Focus ring 2 px, offset 2 px, kolor limonka\n- [ ] Loading nie submituje drugi raz",
            "Poza zakresem": "Podpinanie prawdziwych mutacji.",
            "Pliki docelowe": "`components/ui/*`",
            "Zależności": "Po 1.1.",
        },
    ),
    I(
        "1.3",
        "[UI] Szkielet studia: sidebar + topbar desktop",
        "ui",
        "Faza 0 — Fundament",
        ["area:design-system", "size:L"],
        "E1",
        **{
            "Cel": "Layout 1440×1100 jak D-01: nav 220 px, workspace, ⌘K placeholder.",
            "Figma": f"{figma('92:2384', 'Sidebar')} · {figma('1:3', 'D-01 jako referencja shell')}",
            "Zakres": "- [ ] 5 wariantów aktywnej pozycji\n- [ ] Picker studia\n- [ ] Pozycje poza v1 jako „Wkrótce” (Usługi, Magazyn, Statystyki, Portfolio)\n- [ ] Topbar: breadcrumb, szukaj, avatar",
            "Kryteria akceptacji": "- [ ] Klik „Magazyn” nie 404 — disabled / badge wkrótce\n- [ ] Aktywny item: tło limeDark, tekst lime",
            "Pliki docelowe": "`app/(studio)/layout.tsx`, `components/studio/Sidebar.tsx`, `Topbar.tsx`",
            "Zależności": "Po 1.1–1.2.",
        },
    ),
    I(
        "1.4",
        "[UI] Puste stany, błędy, skeletony",
        "ui",
        "Faza 0 — Fundament",
        ["area:design-system", "size:S"],
        "E1",
        **{
            "Cel": "Wzorce S-01/S-02 do użycia we wszystkich listach.",
            "Figma": f"{figma('17:254', 'S-01')} · {figma('81:756', 'S-02')}",
            "Zakres": "- [ ] Empty, brak wyników filtra, błąd sieci, 404\n- [ ] Skeleton KPI / tabela / kalendarz\n- [ ] `prefers-reduced-motion` wyłącza puls",
            "Kryteria akceptacji": "- [ ] Reduced motion = brak animacji opacity\n- [ ] Komponenty eksportowane, nie kopiowane per ekran",
            "Pliki docelowe": "`components/states/*`",
        },
    ),
    I(
        "2.1",
        "[Impl] Auth.js / Better Auth + sesje w Postgres",
        "implement",
        "Faza 0 — Fundament",
        ["area:auth", "layer:api", "layer:data", "size:M"],
        "E2",
        **{
            "Cel": "Logowanie e-mail + magiczny link lub hasło Argon2id. Self-host, bez Clerka.",
            "Zakres": "- [ ] Tabele auth w Prisma\n- [ ] `/login`, `/logout`\n- [ ] Middleware chroni `/(studio)` i `/admin`",
            "Kryteria akceptacji": "- [ ] Niezalogowany → logowanie\n- [ ] Sesja httpOnly\n- [ ] Reset hasła nie ujawnia, czy e-mail istnieje",
            "Pliki docelowe": "`src/lib/auth.ts`, `app/(auth)/login/page.tsx`, `middleware.ts`",
            "Zależności": "Po 0.1–0.2.",
        },
    ),
    I(
        "2.2",
        "[Impl] Rejestracja trial 14 dni bez karty",
        "implement",
        "Faza 0 — Fundament",
        ["area:auth", "area:billing", "layer:api", "size:M"],
        "E2",
        **{
            "Cel": "`Studio` status=trial, `trialEndsAt` +14 dni, plan domyślny Solo, **bez Stripe na tym etapie**.",
            "Zakres": "- [ ] `/start` (CTA landingu)\n- [ ] Tworzy User + Studio + Membership owner\n- [ ] Brak pola karty",
            "Kryteria akceptacji": "- [ ] Po signup od razu pulpit studia\n- [ ] `trialEndsAt` ustawione\n- [ ] Drugi signup tym samym e-mailem = błąd, nie drugie studio",
            "Pliki docelowe": "`app/(auth)/start/page.tsx`, `src/server/studio/create.ts`",
            "Zależności": "Po 2.1.",
        },
    ),
    I(
        "2.3",
        "[Impl] Role, zaproszenia, tenant guard",
        "implement",
        "Faza 0 — Fundament",
        ["area:auth", "layer:api", "layer:data", "size:M"],
        "E2",
        **{
            "Cel": "owner / manager / worker. Zapytania zawsze przez `studioDb`. Jeden user może mieć wiele membershipów (picker).",
            "Zakres": "- [ ] Invite e-mail\n- [ ] Guard API: 403 przy cudzym studioId\n- [ ] Test dwóch tenantów",
            "Kryteria akceptacji": "- [ ] Worker nie wystawia faktur (ustal: faktury = owner/manager)\n- [ ] ID obcego studia w URL nie wycieka danych — 404",
            "Testy": "- [ ] Dwa studia, ten sam endpoint, zero wycieku",
            "Zależności": "Po 2.1.",
            "Pliki docelowe": "`src/lib/db/tenant.ts`, `src/server/acl.ts`",
        },
    ),
    I(
        "3.1",
        "[UI] D-01 Pulpit — layout i stany",
        "ui",
        "Faza 1 — Operacje",
        ["area:pulpit", "size:L"],
        "E3",
        **{
            "Cel": "Pikselowo bliski D-01 na 1280+. Seed/mock OK.",
            "Figma": f"{figma('1:3', 'D-01 Pulpit')}",
            "Zakres": "- [ ] KPI (przychód, aktywne, obłożenie, powracający)\n- [ ] Mini plan boksów z linią teraz\n- [ ] Tabela dziś + filtry\n- [ ] Karta Na warsztacie + Wymaga uwagi\n- [ ] CTA Nowa wycena / Wystaw fakturę / Nowe zlecenie (wersja po audycie)",
            "Kryteria akceptacji": "- [ ] Porównanie ze zrzutem / Figmą\n- [ ] 7 aktywnych w seedzie (3 w trakcie, 2 odbiór, 2 przyjęte)\n- [ ] Porsche etap 2/4",
            "Poza zakresem": "Liczenie KPI z produkcji — issue 3.2.",
            "Pliki docelowe": "`app/(studio)/page.tsx`, `components/pulpit/*`",
            "Zależności": "Po 1.3 i seed 0.2.",
        },
    ),
    I(
        "3.2",
        "[Impl] KPI pulpitu i alerty z danych",
        "implement",
        "Faza 1 — Operacje",
        ["area:pulpit", "layer:api", "layer:data", "size:M"],
        "E3",
        **{
            "Cel": "Prawdziwe liczby z bazy, nie hardcoded po podłączeniu UI.",
            "Zakres": "- [ ] Przychód miesiąca, aktywne (bez zakończonych), obłożenie boksów, % powracających\n- [ ] Alerty: niski stan (v1: ręczny/minimalny próg albo ukryj jeśli brak magazynu), serwis ceramiki, odrzucenie KSeF\n- [ ] Auto „na warsztacie” = in_progress na dziś w boksie",
            "Kryteria akceptacji": "- [ ] Zakończone nie wchodzą w „aktywne”\n- [ ] Tenant B nie widzi KPI tenanta A",
            "Zależności": "UI 3.1, dane 0.2. Alerty KSeF w pełni po epiku E9 — do wtedy puste lub seed.",
            "Pliki docelowe": "`src/server/pulpit/metrics.ts`",
        },
    ),
    I(
        "4.1",
        "[UI] D-02 Kalendarz zasobowy — dzień",
        "ui",
        "Faza 1 — Operacje",
        ["area:kalendarz", "size:L"],
        "E4",
        **{
            "Cel": "Własny grid boks × godzina. Nie FullCalendar.",
            "Figma": f"{figma('5:10', 'D-02')}",
            "Zakres": "- [ ] 08:00–18:00, Boks 01 i 02, nazwy pracowników\n- [ ] Bloki W trakcie (lime) / Zaplanowane (blue)\n- [ ] Linia „teraz”, przełącznik Dzień/Tydzień (tydzień może być uproszczony)\n- [ ] CTA Nowa rezerwacja",
            "Kryteria akceptacji": "- [ ] Nakładające się eventy w UI nie wyglądają jak jeden boks\n- [ ] Klik bloku → karta zlecenia (gdy 5.3 istnieje; do wtedy href)",
            "Pliki docelowe": "`app/(studio)/calendar/page.tsx`, `components/kalendarz/DayGrid.tsx`",
            "Zależności": "Shell 1.3.",
        },
    ),
    I(
        "4.2",
        "[Impl] Rezerwacje boksów i kolizje",
        "implement",
        "Faza 1 — Operacje",
        ["area:kalendarz", "layer:api", "layer:data", "size:M"],
        "E4",
        **{
            "Cel": "Zapis `scheduledFrom/To` + `bayId`. Odrzut kolizji w tym samym boksie.",
            "Zakres": "- [ ] CRUD rezerwacji powiązanej ze zleceniem\n- [ ] Walidacja overlap\n- [ ] Strefa czasowa Europe/Warsaw",
            "Kryteria akceptacji": "- [ ] Dwa zlecenia 10:00–12:00 w Boks 01 → 409/błąd Zod\n- [ ] Ten sam czas, inny boks → OK",
            "Testy": "- [ ] Unit overlap\n- [ ] Tenant isolation",
            "Pliki docelowe": "`src/server/kalendarz/booking.ts`",
            "Zależności": "Po 0.2 i 4.1.",
        },
    ),
    I(
        "5.1",
        "[UI] D-03 Tablica Kanban + przełącznik listy",
        "ui",
        "Faza 1 — Operacje",
        ["area:zlecenia", "size:L"],
        "E5",
        **{
            "Cel": "4 kolumny statusów, karty jak w Figmie, filtry.",
            "Figma": f"{figma('5:11', 'D-03')}",
            "Zakres": "- [ ] Przyjęte / W trakcie / Do odbioru / Zakończone\n- [ ] Szukaj, pracownik, usługa\n- [ ] DnD wizualny (drop może no-op do 5.2)\n- [ ] Foto na karcie Porsche",
            "Kryteria akceptacji": "- [ ] Kanban 13 px tam gdzie Figma powiększyła body\n- [ ] Liczniki kolumn = liczba kart",
            "Pliki docelowe": "`app/(studio)/orders/page.tsx`",
            "Zależności": "1.3, seed.",
        },
    ),
    I(
        "5.2",
        "[Impl] Maszyna stanów zlecenia",
        "implement",
        "Faza 1 — Operacje",
        ["area:zlecenia", "layer:api", "layer:data", "size:M"],
        "E5",
        **{
            "Cel": "Status + etap 1–4. Numer `DF-####` unikalny w studiu.",
            "Zakres": "- [ ] Transition map (nie można zakończyć z przyjęte bez w trakcie — ustal prostą, jawną mapę)\n- [ ] Historia zmian do zakładki Historia\n- [ ] DnD z 5.1 zapisuje status",
            "Kryteria akceptacji": "- [ ] Zakończone zlecenie można fakturować; aktywne nie\n- [ ] Etap 2/4 na seedzie #DF-0248",
            "Pliki docelowe": "`src/server/zlecenia/state.ts`",
            "Zależności": "5.1, 0.2.",
        },
    ),
    I(
        "5.3",
        "[UI] D-04 Szczegóły zlecenia — przegląd i zakładki",
        "ui",
        "Faza 1 — Operacje",
        ["area:zlecenia", "size:L"],
        "E5",
        **{
            "Cel": "Przegląd jak Figma + osobne taby Zdjęcia, Stan auta, Historia (luka prototypu — zbudować).",
            "Figma": f"{figma('5:12', 'D-04')}",
            "Zakres": "- [ ] Dokumentacja + protokół na przeglądzie\n- [ ] Postęp 4 etapów (studia, nie portalu)\n- [ ] Wycena, kontakt, link klienta, zmień status",
            "Kryteria akceptacji": "- [ ] 4 etapy po stronie studia\n- [ ] Trasa `/orders/DF-0248`",
            "Pliki docelowe": "`app/(studio)/orders/[number]/page.tsx`",
            "Zależności": "5.1.",
        },
    ),
    I(
        "5.4",
        "[Impl] Zdjęcia zlecenia (S3) + protokół przyjęcia",
        "implement",
        "Faza 1 — Operacje",
        ["area:zlecenia", "layer:api", "layer:data", "size:L"],
        "E5",
        **{
            "Cel": "Upload do MinIO/R2, prefix `studioId`. Punkty uszkodzeń ze schematem auta.",
            "Figma": f"{figma('5:12', 'D-04 protokół')}",
            "Zakres": "- [ ] Presigned upload\n- [ ] Metadane: kto, kiedy, etap\n- [ ] IntakeProtocol + punkty 1..n ze zdjęciem\n- [ ] Akceptacja protokołu przez klienta (flaga; UI portalu później)",
            "Kryteria akceptacji": "- [ ] Cudzy studioId w key → 403\n- [ ] URL podpisany, bucket prywatny",
            "Pliki docelowe": "`src/server/zlecenia/photos.ts`, `src/server/zlecenia/intake.ts`",
            "Zależności": "5.3, MinIO z 0.1.",
        },
    ),
    I(
        "6.1",
        "[UI] D-05 Lista klientów i karta",
        "ui",
        "Faza 1 — Operacje",
        ["area:klienci", "size:M"],
        "E6",
        **{
            "Cel": "Tabela + panel Adama Nowaka jak w Figmie.",
            "Figma": f"{figma('5:13', 'D-05')}",
            "Zakres": "- [ ] 20 wierszy, paginacja\n- [ ] Filtry Wszyscy / Stali / Serwis powłoki\n- [ ] Szukaj nazwisko / telefon / rejestracja\n- [ ] Karta: stały klient, auta, historia",
            "Kryteria akceptacji": "- [ ] Paginacja nie tnie layoutu\n- [ ] Zaznaczony wiersz limeDark",
            "Pliki docelowe": "`app/(studio)/customers/page.tsx`",
        },
    ),
    I(
        "6.2",
        "[Impl] CRUD klientów/aut + import CSV",
        "implement",
        "Faza 1 — Operacje",
        ["area:klienci", "layer:api", "layer:data", "size:M"],
        "E6",
        **{
            "Cel": "Landing obiecuje import z Excela — CSV wystarczy w v1.",
            "Zakres": "- [ ] Create/update client+vehicle\n- [ ] Unikalność tablicy w studiu (ostrzeżenie, nie twardy fail jeśli duplikat historyczny — zdecyduj i opisz)\n- [ ] Import CSV (imię, telefon, e-mail, marka, model, tablica)",
            "Kryteria akceptacji": "- [ ] 20/stronę serwerowo, nie wycinaj w kliencie z 124 wierszy\n- [ ] Import nie miesza tenantów",
            "Pliki docelowe": "`src/server/klienci/*`",
            "Zależności": "6.1, 0.2.",
        },
    ),
    I(
        "7.1",
        "[Impl] Silnik ceny wyceny + testy",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:wyceny", "layer:data", "size:S"],
        "E7",
        **{
            "Cel": "`sum(baza) × rozmiar × lakier`, VAT 23% w brutto.",
            "Dokumentacja": f"{DOCS} §5.3",
            "Zakres": "- [ ] Mnożniki: małe 1.0, średnie 1.2, SUV 1.35\n- [ ] Zmiana rozmiaru liczy też czas\n- [ ] Czysta funkcja, zero UI",
            "Kryteria akceptacji": "- [ ] 4000 × 1.2 × 1.0 = 4800.00\n- [ ] VAT = 4800 × 23/123 = 897.56 (zaokrąglenie groszowe udokumentuj)\n- [ ] Żadnego `number` float w kwotach",
            "Testy": "- [ ] Vitest przypadków brzegowych (0 usług, 3 usługi, mnożnik lakieru ≠ 1)",
            "Pliki docelowe": "`src/domain/pricing.ts`, `src/domain/pricing.test.ts`",
        },
    ),
    I(
        "7.2",
        "[UI] Wizard wyceny — kroki 1, 2 i 3",
        "ui",
        "Faza 2 — Pieniądz studia",
        ["area:wyceny", "size:L"],
        "E7",
        **{
            "Cel": "Krok 2 z Figmy + zaprojektowane krok 1 (klient/auto) i krok 3 (termin, podgląd, wysyłka).",
            "Figma": f"{figma('5:14', 'D-06 krok 2')}. Kroki 1 i 3: `file-structure.md` → Do zaprojektowania.",
            "Zakres": "- [ ] Krok 1: klient, auto, rozmiar, stan lakieru/wnętrza\n- [ ] Krok 2: usługi z katalogu, uwagi\n- [ ] Krok 3: termin z kalendarza, podgląd wiadomości, potwierdzenie\n- [ ] Live podsumowanie 4800 zł",
            "Kryteria akceptacji": "- [ ] Autosave szkicu\n- [ ] Wstecz/dalej, krok 3 zablokowany bez usług",
            "Pliki docelowe": "`app/(studio)/quotes/new/page.tsx`",
            "Zależności": "7.1, 1.3.",
        },
    ),
    I(
        "7.3",
        "[Impl] Zapis wyceny i wysyłka do klienta",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:wyceny", "layer:api", "layer:worker", "size:M"],
        "E7",
        **{
            "Cel": "Status draft/sent. Mail + link portalu (token z E8).",
            "Zakres": "- [ ] Persist Quote + items\n- [ ] Job e-mail (Mailpit lokalnie)\n- [ ] Katalog usług: seed + prosta edycja, nie pełny CMS",
            "Kryteria akceptacji": "- [ ] Ponowna wysyłka nie duplikuje pozycji\n- [ ] Tenant isolation",
            "Zależności": "7.2. Link portalu: stub URL do czasu 8.2.",
            "Pliki docelowe": "`src/server/wyceny/send.ts`",
        },
    ),
    I(
        "8.1",
        "[UI] P-01 status zlecenia + P-02 wygasły link",
        "ui",
        "Faza 2 — Pieniądz studia",
        ["area:portal", "size:M"],
        "E8",
        **{
            "Cel": "Mobile-first portal. 3 etapy. Logo + nazwa studia.",
            "Figma": f"{figma('93:2735', 'Portal')} (P-01/P-02 na stronie)",
            "Zakres": "- [ ] P-01: auto, postęp, odbiór, wycena, Zadzwoń\n- [ ] P-02: spokojny stan wygasłego/nieznanego tokenu, nie stack trace\n- [ ] Bez sidebara Detailflow",
            "Kryteria akceptacji": "- [ ] 3 etapy, nie 4\n- [ ] `tel:` do studia",
            "Pliki docelowe": "`app/p/[token]/page.tsx`",
        },
    ),
    I(
        "8.2",
        "[Impl] Tokeny portalu i akceptacja wyceny",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:portal", "layer:api", "layer:data", "size:M"],
        "E8",
        **{
            "Cel": "Hash tokenu w DB, TTL, revoke. Ekran decyzji (brak w Figmie — prosty, w tokenach).",
            "Zakres": "- [ ] `PortalLink.tokenHash`\n- [ ] Accept / reject quote\n- [ ] Po decyzji status Quote + e-mail do studia",
            "Kryteria akceptacji": "- [ ] Surowy token nie leży w logach ani w DB\n- [ ] Wygasły → P-02\n- [ ] Ponowna decyzja niemożliwa",
            "Testy": "- [ ] Enumeration: losowy token → P-02, nie 500",
            "Pliki docelowe": "`src/server/portal/links.ts`",
            "Zależności": "8.1, 7.3.",
        },
    ),
    I(
        "9.1",
        "[UI] D-07 lista faktur + D-10 wymagają uwagi",
        "ui",
        "Faza 2 — Pieniądz studia",
        ["area:faktury", "size:M"],
        "E9",
        **{
            "Cel": "Lista + kolejka błędów KSeF / zaległości.",
            "Figma": f"{figma('22:258', 'D-07')} · {figma('22:831', 'D-10')}",
            "Zakres": "- [ ] Statusy, badge TEST, „2 do uwagi” w nav\n- [ ] Filtry, wyszukiwarka",
            "Kryteria akceptacji": "- [ ] Nav pokazuje licznik uwagi\n- [ ] Nieopłacone vs odrzucone KSeF rozróżnione kolorem",
            "Pliki docelowe": "`app/(studio)/invoices/page.tsx`, `app/(studio)/invoices/attention/page.tsx`",
        },
    ),
    I(
        "9.2",
        "[UI] Wizard FV + D-09 szczegóły i historia KSeF",
        "ui",
        "Faza 2 — Pieniądz studia",
        ["area:faktury", "area:ksef", "size:L"],
        "E9",
        **{
            "Cel": "Krok 2 z Figmy + krok 1 nabywca i krok 3 podgląd (luki). D-09 jak zrzut invoice.",
            "Figma": f"{figma('22:449', 'D-08')} · {figma('22:640', 'D-09')}",
            "Zakres": "- [ ] Nabywca NIP/osoba\n- [ ] Pozycje ze zlecenia\n- [ ] Podgląd FV VAT, QR KSeF, historia zdarzeń, UPO, PDF, korekta, oznacz opłaconą, wyślij ponownie\n- [ ] Badge Przyjęta (test)",
            "Kryteria akceptacji": "- [ ] Numer FV/41/10/2026 w seedzie\n- [ ] Panel KSeF zawsze z etykietą TEST albo PROD",
            "Poza zakresem": "Prawdziwe API MF — 9.4.",
            "Pliki docelowe": "`app/(studio)/invoices/new/page.tsx`, `app/(studio)/invoices/[number]/page.tsx`",
        },
    ),
    I(
        "9.3",
        "[Impl] PDF faktury + generator FA(3) XML",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:faktury", "area:ksef", "layer:worker", "size:L"],
        "E9",
        **{
            "Cel": "PDF jak D-09. XML wg XSD FA(3), nie sklejany string.",
            "Zakres": "- [ ] Szablon PDF (react-pdf lub Puppeteer)\n- [ ] Data wysyłki na PDF; kolejna akcja „Wyślij ponownie”\n- [ ] XML walidowany XSD w CI albo teście",
            "Kryteria akceptacji": "- [ ] XML przechodzi XSD FA(3)\n- [ ] Brutto = netto + VAT grosz w grosz ze zlecenia",
            "Poza zakresem": "Wysyłka HTTP do MF.",
            "Pliki docelowe": "`src/invoices/pdf.ts`, `src/ksef/fa3.ts`",
            "Zależności": "9.2, silnik kwot 7.1.",
        },
    ),
    I(
        "9.4",
        "[Impl] Adapter KSeF 2.0 TEST + worker",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:ksef", "layer:worker", "layer:api", "size:L"],
        "E9",
        **{
            "Cel": "Sesja online, szyfrowanie, poll, UPO, historia jak D-09. Tylko środowisko TEST.",
            "Dokumentacja": f"{DOCS} §5.4. API: https://api.ksef.mf.gov.pl/docs/v2",
            "Zakres": "- [ ] Auth challenge + token studia (szyfr at rest)\n- [ ] POST session, submit, poll ze backoff\n- [ ] Event log: walidacja XSD, wysłano, timeout, przyjęto, numer KSeF\n- [ ] BullMQ job, retry, brak auto-retry na błąd danych nabywcy\n- [ ] UI badge TEST, zero ścieżki PROD",
            "Kryteria akceptacji": "- [ ] Seed/demo timeline FV/41: wystawienie 10:12:08, przyjęcie 10:13:08, 60 s\n- [ ] Błąd NIP zostaje w D-10, nie zapętla worker\n- [ ] Sekrety TEST nie działają przy `KSEF_ENV=production` (twardy throw)",
            "Pliki docelowe": "`src/ksef/client.ts`, `src/worker/ksef.ts`",
            "Zależności": "9.3, Redis z 0.1.",
        },
    ),
    I(
        "9.5",
        "[Impl] Korekta FV i oznacz jako opłaconą",
        "implement",
        "Faza 2 — Pieniądz studia",
        ["area:faktury", "layer:api", "size:S"],
        "E9",
        **{
            "Cel": "Korekta powiązana ze źródłem. Płatność ręczna (przelew), nie Stripe Checkout klienta.",
            "Figma": f"{figma('22:640', 'D-09 akcje')}",
            "Zakres": "- [ ] Wystaw korektę (nowy dokument, link do FV)\n- [ ] `paidAt`, status paid\n- [ ] Nie wolno FV do zlecenia nie-zakończonego",
            "Kryteria akceptacji": "- [ ] Próba FV do #DF-0248 (w trakcie) → błąd\n- [ ] FV do #DF-0243 → OK",
            "Zależności": "9.2, 5.2.",
        },
    ),
    I(
        "10.1",
        "[UI] Tab bar + M-01 pulpit hali",
        "ui",
        "Faza 1 — Operacje",
        ["area:mobile", "area:pulpit", "size:M"],
        "E10",
        **{
            "Cel": "Pracownik na telefonie kończy etap i robi zdjęcie.",
            "Figma": f"{figma('92:3346', 'Tab bar')} · {figma('19:254', 'M-01')}",
            "Zakres": "- [ ] Tab: Pulpit, Kalendarz, +, Zlecenia, Więcej\n- [ ] KPI 3/2/82%, karta Porsche, „Zakończ: Korekta lakieru”, ikona aparatu",
            "Kryteria akceptacji": "- [ ] 390 px bez poziomego scrolla\n- [ ] + otwiera nowe zlecenie/wycenę (sheet)",
            "Pliki docelowe": "`components/studio/TabBar.tsx` (layout mobile)",
            "Zależności": "3.1, 1.3.",
        },
    ),
    I(
        "10.2",
        "[UI] M-02 kalendarz, M-03/M-04 zlecenia",
        "ui",
        "Faza 1 — Operacje",
        ["area:mobile", "size:M"],
        "E10",
        **{
            "Figma": f"{figma('19:397', 'M-02')} · {figma('19:531', 'M-03')} · {figma('20:254', 'M-04')}",
            "Cel": "Te same dane co desktop, layout telefonu.",
            "Zakres": "- [ ] Dzień boksów kompakt\n- [ ] Lista 7 aktywnych w scrollu (M-03)\n- [ ] Szczegóły + zmiana etapu",
            "Kryteria akceptacji": "- [ ] M-03 pokazuje wszystkie aktywne, nie ucina do foldu",
            "Zależności": "4.1, 5.1, 5.3, 10.1.",
        },
    ),
    I(
        "10.3",
        "[UI] M-05 wycena, M-06 więcej, M-07/M-08 faktury",
        "ui",
        "Faza 2 — Pieniądz studia",
        ["area:mobile", "size:M"],
        "E10",
        **{
            "Figma": f"{figma('20:364', 'M-05')} · {figma('32:554', 'M-06')} · {figma('32:671', 'M-07')} · {figma('32:784', 'M-08')}",
            "Zakres": "- [ ] Wycena krok 2 na mobile (rozszerzone opcje = v1.1, nie blokuj)\n- [ ] Menu Więcej\n- [ ] Lista i szczegóły FV",
            "Kryteria akceptacji": "- [ ] Nie wymaga osobnego backendu — te same API",
            "Zależności": "7.2, 9.1, 9.2, 10.1.",
        },
    ),
    I(
        "11.1",
        "[UI] Landing L-01 desktop + L-02 mobile + L-03 menu",
        "ui",
        "Faza 3 — SaaS",
        ["area:landing", "size:L"],
        "E11",
        **{
            "Cel": "„Bez Excela. Bez chaosu.” Cennik 79/149/279. Bez fałszywych opinii.",
            "Figma": f"{figma('93:2737', 'Landing')}",
            "Zakres": "- [ ] Hero, CTA 14 dni, demo 2 min (placeholder)\n- [ ] Preview pulpitu (statyczny obraz/komponent, nie żywe dane obcego studia)\n- [ ] Cennik miesięczny, brak toggle roku\n- [ ] Kalkulator oznaczony jako estymacja albo usunięty do akceptacji prawnej",
            "Kryteria akceptacji": "- [ ] Zero logotypów „klientów” i gwiazdek z makiety demo\n- [ ] CTA → `/start`",
            "Pliki docelowe": "`app/(marketing)/page.tsx`",
        },
    ),
    I(
        "12.1",
        "[Impl] Stripe: produkty, Checkout, webhooki",
        "implement",
        "Faza 3 — SaaS",
        ["area:billing", "layer:api", "size:L"],
        "E12",
        **{
            "Cel": "lookup_key `plan_solo_monthly` / `studio` / `pro`. Idempotentne eventy.",
            "Dokumentacja": f"{DOCS} §11",
            "Zakres": "- [ ] Checkout po trialu\n- [ ] `StripeEvent.id` unique\n- [ ] Obsługa: session.completed, subscription.*, invoice.paid, invoice.payment_failed\n- [ ] Surowe body + podpis",
            "Kryteria akceptacji": "- [ ] Replay tego samego `evt_` nic nie psuje\n- [ ] `payment_failed` → `past_due`\n- [ ] Brak karty na trialu (2.2) nadal prawdziwy",
            "Pliki docelowe": "`app/api/stripe/webhook/route.ts`, `src/server/billing/*`",
            "Zależności": "2.2.",
        },
    ),
    I(
        "12.2",
        "[Impl] Customer Portal, gating past_due, cron trialu",
        "implement",
        "Faza 3 — SaaS",
        ["area:billing", "layer:worker", "size:M"],
        "E12",
        **{
            "Cel": "Zmiana planu w Stripe Portal. Mail 3 dni przed końcem trialu. Cut-off dostępu.",
            "Zakres": "- [ ] Billing Portal session\n- [ ] Restricted mode: odczyt + baner, bez nowych FV (ustal i opisz)\n- [ ] Cron codzienny",
            "Kryteria akceptacji": "- [ ] Anulacja subskrypcji → canceled, login z komunikatem\n- [ ] MRR w kodzie metryk nie dolicza trial/past_due (funkcja, nawet zanim A-04)",
            "Testy": "- [ ] Unit MRR wg `audit/admin/README.md`",
            "Zależności": "12.1.",
        },
    ),
    I(
        "13.1",
        "[UI][Impl] A-01 przegląd + shell admina",
        "implement",
        "Faza 4 — Platforma",
        ["area:admin", "layer:ui", "layer:api", "size:L"],
        "E13",
        **{
            "Cel": "Osobny layout, badge PLATFORM OWNER, prawdziwe KPI.",
            "Figma": f"{figma('118:171', 'A-01')} · sidebar admin `117:457`",
            "Dokumentacja": "`audit/admin/README.md` — definicje MRR, aktywacji, konwersji trialu.",
            "Zakres": "- [ ] Shell + nav 7 pozycji\n- [ ] MRR, płacące, triale, aktywność, wykres, lejek, Do reakcji\n- [ ] Osobna sesja platformy, nie membership studia",
            "Kryteria akceptacji": "- [ ] MRR = 64×79 + 48×149 + 16×279 przy seedzie demo **albo** analogiczna suma z Stripe na żywych danych\n- [ ] Trial nie w MRR\n- [ ] Konwersja = płatne / zakończone triale, nie / bieżące triale",
            "Zależności": "12.2, 2.1.",
            "Pliki docelowe": "`app/(platform)/admin/page.tsx`",
        },
    ),
    I(
        "13.2",
        "[UI][Impl] A-02 lista studiów + A-03 karta",
        "implement",
        "Faza 4 — Platforma",
        ["area:admin", "layer:ui", "layer:api", "size:M"],
        "E13",
        **{
            "Figma": f"{figma('118:359', 'A-02')} · {figma('119:282', 'A-03')}",
            "Zakres": "- [ ] Filtry Aktywne/Trial/Zaległe/Wstrzymane (rozłączne)\n- [ ] CSV\n- [ ] Karta: kontakt, limity, Stripe ids, zdarzenia",
            "Kryteria akceptacji": "- [ ] 166 = 128+24+6+8 w seedzie demo; na produkcji suma filtrów = wszystkie",
            "Zależności": "13.1.",
        },
    ),
    I(
        "13.3",
        "[UI][Impl] A-04 abonamenty i A-05 analityka",
        "implement",
        "Faza 4 — Platforma",
        ["area:admin", "area:billing", "size:M"],
        "E13",
        **{
            "Figma": f"{figma('119:477', 'A-04')} · {figma('120:396', 'A-05')}",
            "Zakres": "- [ ] Skład MRR per plan, wpływy, zaległości, churn, koszty (koszty mogą być ręcznym inputem v1)\n- [ ] Aktywacja, kohorty (brak okna = „—”, nie 0%)",
            "Kryteria akceptacji": "- [ ] Definicje 1:1 z `audit/admin/README.md`\n- [ ] TEST KSeF nie wchodzi w te wykresy",
            "Zależności": "13.1, 12.2.",
        },
    ),
    I(
        "13.4",
        "[UI][Impl] A-06 system/KSeF, A-07 wsparcie, A-08, dialogi A-09/A-10",
        "implement",
        "Faza 4 — Platforma",
        ["area:admin", "area:ksef", "size:L"],
        "E13",
        **{
            "Figma": f"{figma('120:614', 'A-06')} · {figma('121:508', 'A-07')} · {figma('121:661', 'A-08')} · {figma('122:623', 'A-09')} · {figma('122:645', 'A-10')}",
            "Zakres": "- [ ] Kondycja usług, kolejka KSeF, TEST vs PROD **osobne** mianowniki\n- [ ] Tickety + SLA\n- [ ] Role operatorów, MFA TOTP, flagi, audit log\n- [ ] A-09: read-only, 15 min, powód, zgłoszenie — nigdy impersonacja zapisu\n- [ ] A-10: przycisk disabled bez nazwy i powodu; wpisanie nazwy = suspend",
            "Kryteria akceptacji": "- [ ] Sesja wsparcia w AuditLog, wygasa po 15 min\n- [ ] Zła nazwa studia przy zawieszeniu = błąd, konto żyje\n- [ ] MFA wymagane do A-08",
            "Zależności": "13.1, 9.4.",
        },
    ),
    I(
        "14.1",
        "[Impl] Playwright — złote ścieżki v1",
        "implement",
        "Faza 5 — Twardnienie",
        ["area:foundation", "size:L"],
        "E14",
        **{
            "Cel": "E2E z dokumentacji §15.",
            "Zakres": "- [ ] Seed → pulpit 7 aktywnych, Porsche 2/4\n- [ ] Wycena 4800\n- [ ] Portal 3 etapy + wygasły token\n- [ ] FV nie z otwartego zlecenia\n- [ ] Webhook past_due (fixture Stripe)\n- [ ] Tenant leak test",
            "Kryteria akceptacji": "- [ ] CI odpala subset smoke na PR",
            "Pliki docelowe": "`e2e/*.spec.ts`",
            "Zależności": "Ścieżki E3–E9, E12.",
        },
    ),
    I(
        "14.2",
        "[Infra] Sentry, pino, backup Postgres",
        "infra",
        "Faza 5 — Twardnienie",
        ["area:foundation", "size:M"],
        "E14",
        **{
            "Zakres": "- [ ] Sentry web+worker\n- [ ] pino JSON\n- [ ] `pg_dump` cron + retencja\n- [ ] `/api/health` sprawdza db i redis",
            "Kryteria akceptacji": "- [ ] Świadomy błąd w workerze ląduje w Sentry z `studioId` (nie tokenem KSeF)",
        },
    ),
    I(
        "14.3",
        "[Impl] KSeF PROD za flagą + przegląd bezpieczeństwa",
        "implement",
        "Faza 5 — Twardnienie",
        ["area:ksef", "size:M"],
        "E14",
        **{
            "Cel": "Prod tylko per studio, po checklistcie. Review tenant/portal/webhook.",
            "Zakres": "- [ ] `ksefEnv` per Studio, UI badge\n- [ ] CSP, CSRF actions, lockout logowania\n- [ ] Retencja zdjęć opisana w docs",
            "Kryteria akceptacji": "- [ ] Token TEST + env PROD = niemożliwe\n- [ ] Lista §10 z dokumentacji odhaczona w PR",
            "Zależności": "9.4, 13.4.",
            "Poza zakresem": "KSeF offline.",
        },
    ),
]


def existing_issues() -> int:
    out = gh("issue", "list", "-R", REPO, "--limit", "1", "--json", "number")
    data = json.loads(out or "[]")
    return len(data)


def ensure_labels() -> None:
    current = {x["name"] for x in json.loads(gh("label", "list", "-R", REPO, "--json", "name") or "[]")}
    for name, color, desc in LABELS:
        if name in current:
            gh("label", "edit", name, "-R", REPO, "--color", color, "--description", desc)
        else:
            gh("label", "create", name, "-R", REPO, "--color", color, "--description", desc)


def ensure_milestones() -> dict[str, int]:
    raw = json.loads(gh("api", f"repos/{REPO}/milestones?state=open") or "[]")
    have = {m["title"]: m["number"] for m in raw}
    for title, desc in MILESTONES:
        if title in have:
            continue
        created = json.loads(
            gh(
                "api",
                f"repos/{REPO}/milestones",
                "--input",
                "-",
                input_text=json.dumps({"title": title, "description": desc}),
            )
        )
        have[title] = created["number"]
    return have


def create_issue(item: dict, milestones: dict[str, int]) -> int:
    import tempfile
    from pathlib import Path

    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
        fh.write(item["body"])
        path = fh.name
    args = [
        "issue",
        "create",
        "-R",
        REPO,
        "--title",
        item["title"],
        "--body-file",
        path,
        "--milestone",
        item["milestone"],
    ]
    seen = set()
    for lab in item["labels"]:
        if lab and lab not in seen:
            seen.add(lab)
            args.extend(["--label", lab])
    try:
        out = gh(*args)
    finally:
        Path(path).unlink(missing_ok=True)
    num = int(out.rstrip("/").split("/")[-1])
    return num


def main() -> None:
    if existing_issues():
        print("Repo już ma issue — przerywam, żeby nie duplikować.", file=sys.stderr)
        sys.exit(1)
    ensure_labels()
    milestones = ensure_milestones()
    numbers: dict[str, int] = {}
    for item in EPICS:
        n = create_issue(item, milestones)
        numbers[item["key"]] = n
        print(f"epic {item['key']} -> #{n}")
    for item in ISSUES:
        epic_no = numbers[item["epic"]]
        item = dict(item)
        item["body"] = item["body"] + f"\n\n## Epic\n\nParent: #{epic_no} ({item['epic']})\n"
        n = create_issue(item, milestones)
        numbers[item["key"]] = n
        print(f"issue {item['key']} -> #{n}")

    # Update epic bodies with child checklists
    children: dict[str, list[tuple[str, int, str]]] = {e["key"]: [] for e in EPICS}
    for item in ISSUES:
        children[item["epic"]].append((item["key"], numbers[item["key"]], item["title"]))
    for epic_item in EPICS:
        key = epic_item["key"]
        lines = "\n".join(f"- [ ] #{n} {title}" for _k, n, title in children[key])
        new_body = epic_item["body"] + f"\n\n## Issue składowe\n\n{lines}\n"
        import tempfile
        from pathlib import Path

        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
            fh.write(new_body)
            path = fh.name
        try:
            gh("issue", "edit", str(numbers[key]), "-R", REPO, "--body-file", path)
        finally:
            Path(path).unlink(missing_ok=True)
        print(f"updated epic {key} #{numbers[key]}")

    print(json.dumps({k: numbers[k] for k in numbers}, indent=2))


if __name__ == "__main__":
    main()
