// Seed demo: Obsidian Studio 1:1 z makietą (file-structure.md → „Reguły danych
// demonstracyjnych”, Figma D-01/D-03/D-05/D-07/D-09/D-10).
// Czysty reset: studio demo jest usuwane kaskadowo i tworzone od nowa, więc
// `pnpm db:seed` można uruchamiać wielokrotnie. Inne studia zostają nietknięte.

import { pathToFileURL } from "node:url";
import { hashPassword } from "../lib/auth/password";
import { platformDb } from "../lib/db/client";
import { Prisma, type KsefEventKind, type OrderStatus, type VehicleSize } from "../lib/db/generated/client";
import { studioDb } from "../lib/db/tenant";
import { seedServices } from "../src/server/wyceny/catalog";
import { hashPortalToken } from "../lib/portal/token";
import { seedObsidianSupport, seedPlatform } from "./seed-platform";

export const DEMO = {
  studioSlug: "obsidian-studio",
  ownerEmail: "michal.kowalski@example.com",
  // Tylko lokalnie/demo: logowanie na /login bez maila.
  ownerPassword: "obsidian-demo-2026",
  // „Teraz” makiety: 24.10.2026, 11:30.
  now: waw("2026-10-24 11:30"),
  // Stałe tokeny tylko dla danych demo, żeby dało się otworzyć portal lokalnie.
  portalToken: "obsidian-df-0248-demo",
  expiredPortalToken: "obsidian-df-0244-expired",
} as const;

/** Czas lokalny Warszawy → Date. 2026: CEST od 29.03 do 25.10. */
export function waw(local: string): Date {
  const [date = "", time = "00:00"] = local.split(" ");
  const [, m = 0, d = 0] = date.split("-").map(Number);
  const summer = (m > 3 || (m === 3 && d >= 29)) && (m < 10 || (m === 10 && d < 25));
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${summer ? "+02:00" : "+01:00"}`);
}

const D = (v: string | number) => new Prisma.Decimal(v);

/** Brutto z VAT 23% → netto/VAT zaokrąglone do groszy (VAT = brutto − netto). */
function split(gross: string) {
  const g = D(gross);
  const net = g.div("1.23").toDecimalPlaces(2);
  return { net, vat: g.minus(net), gross: g };
}

// ─── Klienci i auta ──────────────────────────────────────────────────────────

type CarSeed = { make: string; model: string; plate: string; year?: number; color?: string; size?: VehicleSize };
type ClientSeed = {
  key: string;
  name: string;
  phone?: string;
  email?: string;
  street?: string;
  postal?: string;
  city?: string;
  nip?: string;
  cars: CarSeed[];
};

// D-05, strona 1 (kolejność jak w tabeli).
const NAMED_CLIENTS: ClientSeed[] = [
  {
    key: "nowak",
    name: "Adam Nowak",
    phone: "+48 600 123 456",
    email: "adam.nowak@example.com",
    street: "ul. Puławska 120/4",
    postal: "02-620",
    city: "Warszawa",
    cars: [
      { make: "Porsche", model: "Panamera", plate: "WA 911PC", year: 2021, color: "czarny" },
      { make: "BMW", model: "X3", plate: "WA 492BM", year: 2019, color: "biały", size: "suv" },
    ],
  },
  { key: "wisniewska", name: "Anna Wiśniewska", phone: "+48 601 482 123", cars: [{ make: "Audi", model: "Q5", plate: "WE 482AX", size: "suv" }] },
  {
    key: "zielinski",
    name: "Piotr Zieliński",
    phone: "+48 602 227 456",
    cars: [
      { make: "BMW", model: "Seria 3", plate: "WZ 227LK" },
      { make: "Škoda", model: "Octavia", plate: "WZ 228LK" },
      { make: "Mini", model: "Cooper", plate: "WZ 229LK", size: "small" },
    ],
  },
  { key: "lis", name: "Tomasz Lis", phone: "+48 603 441 234", cars: [{ make: "BMW", model: "M4", plate: "WW 441TL" }] },
  {
    key: "mazur",
    name: "Ewa Mazur",
    phone: "+48 604 712 567",
    cars: [
      { make: "Volvo", model: "XC60", plate: "WX 712EM", size: "suv" },
      { make: "Fiat", model: "500", plate: "WX 713EM", size: "small" },
    ],
  },
  { key: "lewandowski", name: "Jan Lewandowski", phone: "+48 605 631 789", cars: [{ make: "Mercedes", model: "GLC", plate: "WI 631JL", size: "suv" }] },
  { key: "duda", name: "Marek Duda", phone: "+48 610 100 200", cars: [{ make: "Kia", model: "Sportage", plate: "WI 7731K", size: "suv" }] },
  { key: "kaczmarek", name: "Ola Kaczmarek", phone: "+48 610 101 201", cars: [{ make: "Tesla", model: "Model 3", plate: "WX 582TM" }] },
  { key: "krol", name: "Marcin Król", phone: "+48 610 102 202", cars: [{ make: "Volkswagen", model: "Golf", plate: "WX 4002K", size: "small" }] },
  ...[
    "Karol Wrona",
    "Monika Sikora",
    "Paweł Urban",
    "Natalia Lis",
    "Łukasz Jankowski",
    "Kamil Wójcik",
    "Julia Baran",
    "Robert Zając",
    "Agnieszka Dudek",
    "Dawid Nowicki",
    "Joanna Wolska",
  ].map((name, i) => ({
    key: `p1-${i + 3}`,
    name,
    phone: `+48 610 ${103 + i} ${203 + i}`,
    cars: [{ make: "Toyota", model: "Corolla", plate: `WX ${4003 + i}K` }],
  })),
];

// Nabywcy z D-07 i auto z kalendarza D-02.
const OTHER_CLIENTS: ClientSeed[] = [
  { key: "detailing-pro", name: "Detailing Pro sp. z o.o.", nip: "5250001122", city: "Warszawa", cars: [{ make: "Audi", model: "A6", plate: "WB 1122DP" }] },
  // NIP celowo ma 9 cyfr — powód odrzucenia FV/39 w KSeF (D-10).
  { key: "kowal", name: "Auto Serwis Kowal", nip: "123456780", city: "Piaseczno", cars: [{ make: "Škoda", model: "Superb", plate: "WPI 3456K" }] },
  { key: "fleet", name: "Fleet Rent S.A.", nip: "7010023344", city: "Warszawa", cars: [{ make: "Toyota", model: "RAV4", plate: "WY 2334FR", size: "suv" }] },
  { key: "wojcik", name: "Jakub Wójcik", cars: [{ make: "Mercedes", model: "Klasa C", plate: "WN 5521JW" }] },
];

const CLIENT_TOTAL = 124;
const REGULAR_TOTAL = 79;
const VEHICLE_TOTAL = 168;

const FIRST = ["Bartosz", "Magdalena", "Krzysztof", "Katarzyna", "Michał", "Aleksandra", "Wojciech", "Zofia", "Grzegorz", "Maria"];
const LAST = ["Kamiński", "Lewandowska", "Szymański", "Woźniak", "Dąbrowski", "Kozłowska", "Jankowska", "Mazurek", "Krawczyk", "Piotrowska"];
const MAKES: [string, string][] = [
  ["Toyota", "Yaris"],
  ["Škoda", "Fabia"],
  ["Hyundai", "Tucson"],
  ["Ford", "Focus"],
  ["Mazda", "CX-5"],
  ["Renault", "Clio"],
  ["Opel", "Astra"],
  ["Peugeot", "3008"],
];

/** Uzupełnia bazę do 124 klientów / 168 aut (D-05: „124 klientów · 168 aut”). */
function fillerClients(): ClientSeed[] {
  const named = [...NAMED_CLIENTS, ...OTHER_CLIENTS];
  const count = CLIENT_TOTAL - named.length;
  let extraCars = VEHICLE_TOTAL - named.reduce((n, c) => n + c.cars.length, 0) - count;
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const carCount = extraCars-- > 0 ? 2 : 1;
    const cars = Array.from({ length: carCount }, (_, j) => {
      const [make, model] = MAKES[(i + j) % MAKES.length]!;
      return { make, model, plate: `WX ${5000 + n * 2 + j}D` };
    });
    return {
      key: `demo-${n}`,
      name: `${FIRST[i % FIRST.length]} ${LAST[Math.floor(i / FIRST.length) % LAST.length]}`,
      phone: `+48 620 ${String(100 + n).padStart(3, "0")} ${String(300 + n).padStart(3, "0")}`,
      cars,
    };
  });
}

// ─── Zlecenia ────────────────────────────────────────────────────────────────

type OrderSeed = {
  number: string;
  client: string;
  plate: string;
  bay?: 1 | 2;
  status: OrderStatus;
  stage: number;
  service: string;
  from: string;
  to: string;
  due?: string;
  completed?: string;
  gross: string;
};

// D-03: 2 przyjęte, 3 w trakcie, 2 do odbioru (= 7 aktywnych) + zakończone.
const ORDERS: OrderSeed[] = [
  { number: "DF-0251", client: "krol", plate: "WX 4002K", status: "accepted", stage: 1, service: "Mycie + wosk", from: "2026-10-24 14:00", to: "2026-10-24 16:00", due: "2026-10-24 17:00", gross: "350.00" },
  { number: "DF-0252", client: "mazur", plate: "WX 712EM", status: "accepted", stage: 1, service: "Pranie tapicerki", from: "2026-10-25 09:00", to: "2026-10-25 13:00", due: "2026-10-25 15:00", gross: "800.00" },
  { number: "DF-0248", client: "nowak", plate: "WA 911PC", bay: 1, status: "in_progress", stage: 2, service: "Korekta + ceramika", from: "2026-10-24 08:00", to: "2026-10-24 13:00", due: "2026-10-25 16:00", gross: "4800.00" },
  { number: "DF-0249", client: "wisniewska", plate: "WE 482AX", bay: 2, status: "in_progress", stage: 3, service: "Pakiet premium", from: "2026-10-24 08:30", to: "2026-10-24 12:00", due: "2026-10-24 12:00", gross: "1200.00" },
  { number: "DF-0247", client: "duda", plate: "WI 7731K", status: "in_progress", stage: 2, service: "Pranie tapicerki + ozon", from: "2026-10-24 09:00", to: "2026-10-24 15:00", due: "2026-10-24 15:00", gross: "900.00" },
  { number: "DF-0245", client: "zielinski", plate: "WZ 227LK", status: "ready_for_pickup", stage: 4, service: "Detailing wnętrza", from: "2026-10-23 09:00", to: "2026-10-23 14:00", due: "2026-10-24 12:30", gross: "650.00" },
  { number: "DF-0246", client: "kaczmarek", plate: "WX 582TM", status: "ready_for_pickup", stage: 4, service: "Serwis powłoki", from: "2026-10-23 13:00", to: "2026-10-23 15:00", due: "2026-10-24 15:00", gross: "400.00" },
  { number: "DF-0244", client: "lewandowski", plate: "WI 631JL", status: "completed", stage: 4, service: "Powłoka ceramiczna", from: "2026-10-22 08:00", to: "2026-10-23 16:00", due: "2026-10-24 10:00", completed: "2026-10-24 10:20", gross: "3200.00" },
  // Źródło FV/41 — zakończone 23.10.2026. To NIE jest #DF-0248.
  { number: "DF-0243", client: "nowak", plate: "WA 492BM", status: "completed", stage: 4, service: "Korekta + ceramika", from: "2026-10-22 08:00", to: "2026-10-23 15:00", due: "2026-10-23 16:00", completed: "2026-10-23 16:30", gross: "4800.00" },
  { number: "DF-0241", client: "kowal", plate: "WPI 3456K", status: "completed", stage: 4, service: "Pakiet flotowy", from: "2026-10-23 08:00", to: "2026-10-23 12:00", completed: "2026-10-23 13:30", gross: "1845.00" },
  { number: "DF-0239", client: "wisniewska", plate: "WE 482AX", status: "completed", stage: 4, service: "Pakiet premium", from: "2026-10-22 13:00", to: "2026-10-23 11:00", completed: "2026-10-23 12:00", gross: "1200.00" },
  { number: "DF-0236", client: "zielinski", plate: "WZ 228LK", status: "completed", stage: 4, service: "Detailing wnętrza", from: "2026-10-21 09:00", to: "2026-10-22 12:00", completed: "2026-10-22 13:00", gross: "650.00" },
  { number: "DF-0230", client: "fleet", plate: "WY 2334FR", status: "completed", stage: 4, service: "Pakiet flotowy × 7", from: "2026-10-16 08:00", to: "2026-10-21 16:00", completed: "2026-10-21 16:30", gross: "8610.00" },
  { number: "DF-0228", client: "lis", plate: "WW 441TL", status: "completed", stage: 4, service: "Detailing wnętrza + ozon", from: "2026-10-09 09:00", to: "2026-10-09 16:00", completed: "2026-10-10 09:00", gross: "1200.00" },
  { number: "DF-0226", client: "mazur", plate: "WX 713EM", status: "completed", stage: 4, service: "Korekta jednoetapowa", from: "2026-10-07 08:00", to: "2026-10-08 15:00", completed: "2026-10-08 16:00", gross: "2250.00" },
  // Wcześniejsze wizyty Adama Nowaka — karta klienta D-05: „Klient od marca 2025 · 6 wizyt”,
  // łącznie 12 350 zł z DF-0248 i DF-0243. Daty i kwoty ostatnich wizyt z makiety (14.08, 12.04).
  { number: "DF-0188", client: "nowak", plate: "WA 492BM", status: "completed", stage: 4, service: "Mycie premium", from: "2026-08-14 10:00", to: "2026-08-14 12:00", completed: "2026-08-14 12:30", gross: "450.00" },
  { number: "DF-0142", client: "nowak", plate: "WA 911PC", status: "completed", stage: 4, service: "Mycie detailingowe", from: "2026-04-12 09:00", to: "2026-04-12 12:00", completed: "2026-04-12 12:30", gross: "600.00" },
  { number: "DF-0097", client: "nowak", plate: "WA 911PC", status: "completed", stage: 4, service: "Odświeżenie powłoki", from: "2025-11-20 09:00", to: "2025-11-20 14:00", completed: "2025-11-20 14:30", gross: "1100.00" },
  { number: "DF-0003", client: "nowak", plate: "WA 911PC", status: "completed", stage: 4, service: "Mycie detailingowe + wosk", from: "2025-03-14 13:00", to: "2025-03-14 15:00", completed: "2025-03-14 15:30", gross: "600.00" },
];

// ─── Faktury (KSeF TEST) ─────────────────────────────────────────────────────

type InvoiceSeed = {
  number: string;
  order: string;
  buyer: string;
  ksefStatus: "accepted" | "rejected" | "retrying";
  ksefNumber?: string;
  issued: string;
  accepted?: string;
  due: string;
  paid?: string;
  emailed?: string;
  items: { name: string; gross: string }[];
  events?: { kind: KsefEventKind; at: string; message: string; attempt?: number; ref?: string }[];
};

// Nieopłacone (przyjęte w KSeF): FV/41 4 800 + FV/35 1 200 + FV/34 2 250 = 8 250 zł.
// Po terminie na 24.10: FV/35 + FV/34 = 3 450 zł (2 faktury).
const INVOICES: InvoiceSeed[] = [
  {
    number: "FV/41/10/2026",
    order: "DF-0243",
    buyer: "nowak",
    ksefStatus: "accepted",
    ksefNumber: "9512345678-20261024-8F3A21C4B7E0-5D",
    issued: "2026-10-24 10:12:08",
    accepted: "2026-10-24 10:13:08",
    due: "2026-10-31 23:59:59",
    emailed: "2026-10-24 10:13:30",
    items: [
      { name: "Korekta lakieru · 2 etapy", gross: "2400.00" },
      { name: "Powłoka ceramiczna 3 lata", gross: "2400.00" },
    ],
    events: [
      { kind: "issued", at: "2026-10-24 10:12:08", message: "Wystawiono, numer FV/41/10/2026" },
      { kind: "validated", at: "2026-10-24 10:12:08", message: "Walidacja XSD FA(3) OK · 18 ms" },
      { kind: "timeout", at: "2026-10-24 10:12:38", attempt: 1, message: "Próba 1: timeout, następnie sprawdzono status" },
      { kind: "sent", at: "2026-10-24 10:12:40", attempt: 2, ref: "20261024-EE-2B4F91C07A-3E", message: "Próba 2: wysłano" },
      { kind: "processing", at: "2026-10-24 10:12:41", message: "Przetwarzanie w KSeF" },
      { kind: "accepted", at: "2026-10-24 10:13:08", message: "Przyjęta, nadano numer KSeF" },
    ],
  },
  {
    number: "FV/40/10/2026",
    order: "DF-0244",
    buyer: "detailing-pro",
    ksefStatus: "accepted",
    ksefNumber: "5250001122-20261024-1C9D4E7A2B30-71",
    issued: "2026-10-24 10:25:00",
    accepted: "2026-10-24 10:25:52",
    due: "2026-11-07 23:59:59",
    paid: "2026-10-24 10:30:00",
    emailed: "2026-10-24 10:26:00",
    items: [{ name: "Powłoka ceramiczna", gross: "3200.00" }],
  },
  {
    number: "FV/39/10/2026",
    order: "DF-0241",
    buyer: "kowal",
    ksefStatus: "rejected",
    issued: "2026-10-23 14:02:00",
    due: "2026-11-06 23:59:59",
    items: [{ name: "Pakiet flotowy", gross: "1845.00" }],
    events: [
      { kind: "issued", at: "2026-10-23 14:02:00", message: "Wystawiono, numer FV/39/10/2026" },
      { kind: "sent", at: "2026-10-23 14:02:03", attempt: 1, ref: "20261023-EE-7C21A0D3F1-4B", message: "Próba 1: wysłano" },
      { kind: "rejected", at: "2026-10-23 14:02:31", attempt: 1, ref: "20261023-EE-7C21A0D3F1-4B", message: "Nieprawidłowy NIP nabywcy (Podmiot2/DaneIdentyfikacyjne/NIP) · nie ponawiamy (błąd danych)" },
    ],
  },
  {
    number: "FV/38/10/2026",
    order: "DF-0239",
    buyer: "wisniewska",
    ksefStatus: "retrying",
    issued: "2026-10-23 12:40:00",
    due: "2026-10-30 23:59:59",
    items: [{ name: "Pakiet premium", gross: "1200.00" }],
    events: [
      { kind: "issued", at: "2026-10-23 12:40:00", message: "Wystawiono, numer FV/38/10/2026" },
      { kind: "timeout", at: "2026-10-23 12:40:30", attempt: 1, message: "Brak odpowiedzi KSeF (test)" },
      { kind: "timeout", at: "2026-10-24 11:14:00", attempt: 2, message: "Brak odpowiedzi KSeF (test)" },
      { kind: "retry_scheduled", at: "2026-10-24 11:30:00", attempt: 3, message: "Ponawiamy · próba 3 z 8, kolejna za 8 min" },
    ],
  },
  {
    number: "FV/37/10/2026",
    order: "DF-0236",
    buyer: "zielinski",
    ksefStatus: "accepted",
    ksefNumber: "9512345678-20261022-4A7E19B2C5D8-0F",
    issued: "2026-10-22 13:10:00",
    accepted: "2026-10-22 13:10:41",
    due: "2026-10-29 23:59:59",
    paid: "2026-10-22 13:15:00",
    emailed: "2026-10-22 13:11:00",
    items: [{ name: "Detailing wnętrza", gross: "650.00" }],
  },
  {
    number: "FV/36/10/2026",
    order: "DF-0230",
    buyer: "fleet",
    ksefStatus: "accepted",
    ksefNumber: "9512345678-20261021-B3C80D1E92F4-A6",
    issued: "2026-10-21 17:00:00",
    accepted: "2026-10-21 17:00:39",
    due: "2026-11-04 23:59:59",
    paid: "2026-10-23 09:00:00",
    emailed: "2026-10-21 17:01:00",
    items: [{ name: "Pakiet flotowy × 7", gross: "8610.00" }],
  },
  {
    number: "FV/35/10/2026",
    order: "DF-0228",
    buyer: "lis",
    ksefStatus: "accepted",
    ksefNumber: "9512345678-20261010-77E2A9C4D1B0-2C",
    issued: "2026-10-10 09:20:00",
    accepted: "2026-10-10 09:20:44",
    due: "2026-10-17 23:59:59",
    emailed: "2026-10-10 09:21:00",
    items: [{ name: "Detailing wnętrza + ozon", gross: "1200.00" }],
  },
  {
    number: "FV/34/10/2026",
    order: "DF-0226",
    buyer: "mazur",
    ksefStatus: "accepted",
    ksefNumber: "9512345678-20261008-0D5B6E3F8A21-94",
    issued: "2026-10-08 16:20:00",
    accepted: "2026-10-08 16:20:37",
    due: "2026-10-15 23:59:59",
    emailed: "2026-10-08 16:21:00",
    items: [{ name: "Korekta jednoetapowa", gross: "2250.00" }],
  },
];

// ─── Seed ────────────────────────────────────────────────────────────────────

export async function seed() {
  // Czysty reset: kaskada z Studio usuwa dane operacyjne demo. Kohorta A-02
  // (df-demo-*) jest odtwarzana przez seedPlatform; inne studia zostają nietknięte.
  // Sprzątamy też kohortę ze starszej wersji seeda (platform-demo-*).
  await platformDb.studio.deleteMany({ where: { slug: { startsWith: "platform-demo-" } } });
  await platformDb.user.deleteMany({ where: { email: { endsWith: "@platform-demo.detailflow.test" } } });
  await platformDb.studio.deleteMany({ where: { slug: DEMO.studioSlug } });

  const studio = await platformDb.studio.create({
    data: {
      publicCode: "ST-00128",
      name: "Obsidian Studio",
      slug: DEMO.studioSlug,
      ownerLegalName: "Obsidian Studio Michał Kowalski",
      nip: "9512345678",
      address: "ul. Rzemieślnicza 12",
      postal: "02-675",
      city: "Warszawa",
      district: "Mokotów",
      phone: "+48 600 100 128",
      status: "active",
      plan: "studio",
      stripeCustomerId: "cus_seed_ST00128",
      stripeSubscriptionId: "sub_seed_ST00128",
      ksefEnv: "test",
      createdAt: waw("2025-03-03 10:00"),
      activatedAt: waw("2025-03-03 10:00"),
    },
  });
  const studioId = studio.id;
  const db = studioDb(studioId);
  await seedServices(studioId);

  const owner = await platformDb.user.upsert({
    where: { email: DEMO.ownerEmail },
    update: { name: "Michał Kowalski", emailVerified: true },
    create: { email: DEMO.ownerEmail, name: "Michał Kowalski", emailVerified: true },
  });
  // Konto hasłowe Better Auth: providerId "credential", accountId = userId.
  const password = await hashPassword(DEMO.ownerPassword);
  await platformDb.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: owner.id } },
    update: { password },
    create: { userId: owner.id, providerId: "credential", accountId: owner.id, password },
  });
  await db.membership.create({ data: { studioId, userId: owner.id, role: "owner" } });

  const [bay1, bay2] = await db.bay.createManyAndReturn({
    data: [
      { studioId, name: "Boks 01", sort: 1 },
      { studioId, name: "Boks 02", sort: 2 },
    ],
  });
  const bays = { 1: bay1!.id, 2: bay2!.id };

  const allClients = [...NAMED_CLIENTS, ...OTHER_CLIENTS, ...fillerClients()];
  const createdClients = await db.client.createManyAndReturn({
    data: allClients.map((c, i) => ({
      studioId,
      name: c.name,
      phone: c.phone,
      email: c.email,
      street: c.street,
      postal: c.postal,
      city: c.city,
      nip: c.nip,
      isRegular: i < REGULAR_TOTAL,
      // Nowak jest klientem od marca 2025; reszta ma kolejne sekundy, żeby kolejność listy
      // (createdAt, id) była zawsze taka sama jak kolejność w tabeli D-05.
      createdAt: i === 0 ? waw("2025-03-14 12:00") : new Date(waw("2025-06-01 12:00").getTime() + i * 1000),
    })),
  });
  // Mapowanie po nazwie, nie po kolejności RETURNING (nazwy w seedzie są unikalne).
  const idByName = new Map(createdClients.map((c) => [c.name, c.id]));
  if (idByName.size !== allClients.length) throw new Error("Seed client names must be unique");
  const clientId = new Map(allClients.map((c) => [c.key, idByName.get(c.name)!]));

  // Kolejne milisekundy w createdAt utrwalają kolejność aut klienta (pierwsze = główne w tabeli D-05).
  const vehicleBase = waw("2025-06-01 12:00").getTime();
  let vehicleIndex = 0;
  const createdVehicles = await db.vehicle.createManyAndReturn({
    data: allClients.flatMap((c) =>
      c.cars.map((car) => ({
        createdAt: new Date(vehicleBase + vehicleIndex++),
        studioId,
        clientId: clientId.get(c.key)!,
        make: car.make,
        model: car.model,
        plate: car.plate,
        year: car.year,
        color: car.color,
        size: car.size ?? "medium",
      })),
    ),
  });
  const vehicleId = new Map(createdVehicles.map((v) => [v.plate, v.id]));
  await db.coatingReminder.createMany({
    data: ["WA 911PC", "WE 482AX", "WZ 227LK"].map((plate) => ({
      studioId,
      vehicleId: vehicleId.get(plate)!,
      dueAt: waw("2026-10-30 12:00"),
    })),
  });

  // Wycena #DF-0248 (D-04/D-06): 4 000 zł × 1,20 × 1,00 = 4 800 zł, VAT 897,56 zł.
  const porscheQuote = await db.quote.create({
    data: {
      studioId,
      clientId: clientId.get("nowak")!,
      vehicleId: vehicleId.get("WA 911PC")!,
      status: "accepted",
      sizeMult: D("1.20"),
      paintMult: D("1.00"),
      totalGross: D("4800.00"),
      vatAmount: split("4800.00").vat,
      sentAt: waw("2026-10-22 18:05"),
      decidedAt: waw("2026-10-22 19:41"),
      // Zagnieżdżone pozycje dziedziczą studioId z wyceny (FK (quoteId, studioId)).
      items: {
        create: [
          { name: "Korekta lakieru · 2 etapy", basePrice: D("2000.00"), durationMin: 300, sort: 1 },
          { name: "Powłoka ceramiczna · 3 lata", basePrice: D("2000.00"), durationMin: 240, sort: 2 },
        ],
      },
    },
  });

  const orderId = new Map<string, string>();
  for (const o of ORDERS) {
    const created = await db.workOrder.create({
      data: {
        studioId,
        number: o.number,
        clientId: clientId.get(o.client)!,
        vehicleId: vehicleId.get(o.plate)!,
        bayId: o.bay ? bays[o.bay] : null,
        quoteId: o.number === "DF-0248" ? porscheQuote.id : null,
        status: o.status,
        stage: o.stage,
        service: o.service,
        scheduledFrom: waw(o.from),
        scheduledTo: waw(o.to),
        dueAt: o.due ? waw(o.due) : null,
        completedAt: o.completed ? waw(o.completed) : null,
        totalGross: D(o.gross),
        createdAt: waw(o.from),
      },
    });
    orderId.set(o.number, created.id);
  }

  // Historia (zakładka Historia): utworzenie każdego zlecenia, a dla #DF-0248
  // dodatkowo start pracy i przejście na etap 2.
  const ownerId = owner.id;
  await db.workOrderEvent.createMany({
    data: ORDERS.map((o) => ({
      studioId,
      workOrderId: orderId.get(o.number)!,
      toStatus: "accepted" as const,
      toStage: 1,
      actorId: ownerId,
      createdAt: waw(o.from),
    })),
  });
  await db.workOrderEvent.createMany({
    data: [
      { studioId, workOrderId: orderId.get("DF-0248")!, fromStatus: "accepted", toStatus: "in_progress", fromStage: 1, toStage: 1, actorId: ownerId, createdAt: waw("2026-10-24 08:05") },
      { studioId, workOrderId: orderId.get("DF-0248")!, fromStatus: "in_progress", toStatus: "in_progress", fromStage: 1, toStage: 2, actorId: ownerId, createdAt: waw("2026-10-24 09:40") },
    ],
  });
  // Licznik numerów DF-#### startuje od najwyższego numeru z makiety.
  await db.orderCounter.create({ data: { studioId, last: Math.max(...ORDERS.map((o) => Number(o.number.slice(3)))) } });

  for (const inv of INVOICES) {
    const order = ORDERS.find((o) => o.number === inv.order)!;
    // Kontrakt: faktura tylko z zakończonego zlecenia.
    if (order.status !== "completed") throw new Error(`${inv.number}: ${inv.order} is not completed`);
    const buyer = allClients.find((c) => c.key === inv.buyer)!;
    const lines = inv.items.map((item) => ({ name: item.name, ...split(item.gross) }));
    const total = split(inv.items.reduce((sum, i) => sum.plus(i.gross), D(0)).toFixed(2));

    await db.invoice.create({
      data: {
        studioId,
        number: inv.number,
        workOrderId: orderId.get(inv.order)!,
        status: "issued",
        ksefEnv: "test",
        ksefStatus: inv.ksefStatus,
        ksefNumber: inv.ksefNumber,
        ksefAcceptedAt: inv.accepted ? waw(inv.accepted) : null,
        buyerName: buyer.name,
        buyerNip: buyer.nip,
        buyerStreet: buyer.street,
        buyerPostal: buyer.postal,
        buyerCity: buyer.city,
        issuedAt: waw(inv.issued),
        saleAt: waw(inv.issued.slice(0, 10)),
        dueAt: waw(inv.due),
        paidAt: inv.paid ? waw(inv.paid) : null,
        emailedAt: inv.emailed ? waw(inv.emailed) : null,
        // Suma pozycji, nie przeliczenie sumy brutto — zgodnie z D-09.
        totalNet: lines.reduce((s, l) => s.plus(l.net), D(0)),
        totalVat: lines.reduce((s, l) => s.plus(l.vat), D(0)),
        totalGross: total.gross,
        createdAt: waw(inv.issued),
        items: {
          create: lines.map((l, i) => ({
            lp: i + 1,
            name: l.name,
            quantity: D(1),
            unit: "usł.",
            unitNet: l.net,
            vatRate: 23,
            net: l.net,
            vat: l.vat,
            gross: l.gross,
          })),
        },
        events: {
          create: (inv.events ?? []).map((e) => ({
            kind: e.kind,
            at: waw(e.at),
            attempt: e.attempt,
            ref: e.ref,
            message: e.message,
          })),
        },
      },
    });
  }

  await db.portalLink.createMany({
    data: [
      { studioId, workOrderId: orderId.get("DF-0248")!, tokenHash: hashPortalToken(DEMO.portalToken), expiresAt: waw("2026-11-23 23:59") },
      // P-02: wygasły link.
      { studioId, workOrderId: orderId.get("DF-0244")!, tokenHash: hashPortalToken(DEMO.expiredPortalToken), expiresAt: waw("2026-10-01 23:59") },
    ],
  });

  const platform = await seedPlatform();
  await seedObsidianSupport(studioId, platform.operatorId);
  await platformDb.auditLog.createMany({
    data: [
      { studioId, actorId: owner.id, action: "studio.created", meta: {}, createdAt: waw("2025-03-03 10:00") },
      { studioId, actorId: owner.id, action: "billing.subscription_active", meta: { plan: "studio" }, createdAt: waw("2025-03-17 10:00") },
    ],
  });

  return { studioId };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then(({ studioId }) => {
      console.log(`Seeded Obsidian Studio (${studioId}) and platform demo`);
    })
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => platformDb.$disconnect());
}
