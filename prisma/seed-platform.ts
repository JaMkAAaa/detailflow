import { hashPassword } from "../lib/auth/password";
import { platformDb } from "../lib/db/client";
import type { Plan, StudioStatus } from "../lib/db/generated/client";
import { Prisma } from "../lib/db/generated/client";
import { DEMO_OCTOBER_COSTS, DEMO_OCTOBER_RECEIPTS } from "../src/server/admin/demo-receipts";

/** Czas lokalny Warszawy → Date. 2026: CEST od 29.03 do 25.10. */
function waw(local: string): Date {
  const [date = "", time = "00:00"] = local.split(" ");
  const [, m = 0, d = 0] = date.split("-").map(Number);
  const summer = (m > 3 || (m === 3 && d >= 29)) && (m < 10 || (m === 10 && d < 25));
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}${summer ? "+02:00" : "+01:00"}`);
}

export const PLATFORM_DEMO = {
  slugPrefix: "df-demo-",
  email: "anna.nowak@detailflow.test",
  password: "platform-demo-2026",
  name: "Anna Nowak",
  now: waw("2026-10-26 11:30"),
} as const;

const CITIES = ["Kraków", "Gdańsk", "Wrocław", "Poznań", "Łódź", "Katowice", "Lublin", "Szczecin"];

type Extra = {
  slug: string;
  publicCode: string;
  name: string;
  city: string;
  status: StudioStatus;
  plan: Plan;
  createdAt: Date;
  activatedAt: Date | null;
  trialEndsAt: Date | null;
  updatedAt: Date;
  firstWeekOrders: number;
  recentOrder: boolean;
};

const FEATURE_FLAGS = [
  {
    key: "ksef_prod",
    label: "KSeF PROD",
    description: "Pozwala właścicielowi studia przejść na produkcyjne API KSeF. Domyślnie wyłączona. Token TEST nie działa na PROD.",
    enabled: false,
  },
  {
    key: "annual_billing",
    label: "Abonament roczny",
    description: "Poza v1. Nie tworzy ceny rocznej w Stripe.",
    enabled: false,
  },
  {
    key: "client_online_pay",
    label: "Płatność online klienta",
    description: "Poza v1. Nie przyjmuje płatności za detailing.",
    enabled: false,
  },
] as const;

export async function seedFeatureFlags() {
  for (const flag of FEATURE_FLAGS) {
    await platformDb.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: { key: flag.key, label: flag.label, description: flag.description, enabled: flag.enabled },
    });
  }
}

/** Dwa zgłoszenia Obsidian Studio, żeby A-07 miało kolejkę i SLA po seedzie. */
export async function seedObsidianSupport(studioId: string, actorId: string) {
  const now = PLATFORM_DEMO.now;
  await platformDb.supportTicket.deleteMany({ where: { publicCode: { in: ["TK-00041", "TK-00042"] } } });
  await platformDb.supportTicket.create({
    data: {
      publicCode: "TK-00041",
      studioId,
      subject: "Faktura TEST odrzucona przez KSeF",
      status: "open",
      priority: "urgent",
      openedAt: new Date(now.getTime() - 20 * 60_000),
      slaDueAt: new Date(now.getTime() + 40 * 60_000),
      assigneeId: actorId,
      messages: {
        create: {
          fromStudio: true,
          body: "FV na środowisku TEST wraca z błędem danych nabywcy. Proszę o podgląd, bez zmian w koncie.",
          createdAt: new Date(now.getTime() - 20 * 60_000),
        },
      },
    },
  });
  await platformDb.supportTicket.create({
    data: {
      publicCode: "TK-00042",
      studioId,
      subject: "Pracownik nie może wejść do kalendarza",
      status: "waiting",
      priority: "normal",
      openedAt: new Date(now.getTime() - 26 * 60 * 60_000),
      slaDueAt: new Date(now.getTime() - 18 * 60 * 60_000),
      assigneeId: actorId,
      messages: {
        create: [
          {
            fromStudio: true,
            body: "Konto pracownika kończy się błędem po zalogowaniu.",
            createdAt: new Date(now.getTime() - 26 * 60 * 60_000),
          },
          {
            authorId: actorId,
            fromStudio: false,
            body: "Sprawdziliśmy sesję. Poproś pracownika o nowy link i daj znać, czy wszedł.",
            createdAt: new Date(now.getTime() - 25 * 60 * 60_000),
          },
        ],
      },
    },
  });
}

/** 166 kont makiety + zakończone triale i odejścia do konwersji / MRR. */
export async function seedPlatform() {
  await seedFeatureFlags();
  await platformDb.studio.deleteMany({ where: { slug: { startsWith: PLATFORM_DEMO.slugPrefix } } });

  const operator = await platformDb.user.upsert({
    where: { email: PLATFORM_DEMO.email },
    update: { name: PLATFORM_DEMO.name, emailVerified: true },
    create: { email: PLATFORM_DEMO.email, name: PLATFORM_DEMO.name, emailVerified: true },
  });
  const password = await hashPassword(PLATFORM_DEMO.password);
  await platformDb.account.upsert({
    where: { providerId_accountId: { providerId: "credential", accountId: operator.id } },
    update: { password },
    create: { userId: operator.id, providerId: "credential", accountId: operator.id, password },
  });
  await platformDb.platformOperator.upsert({
    where: { userId: operator.id },
    update: { role: "owner" },
    create: { userId: operator.id, role: "owner" },
  });

  const now = PLATFORM_DEMO.now;
  const extras = buildExtras(now);
  const created = await platformDb.studio.createManyAndReturn({
    data: extras.map((row) => ({
      publicCode: row.publicCode,
      name: row.name,
      slug: row.slug,
      city: row.city,
      status: row.status,
      plan: row.plan,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      activatedAt: row.activatedAt,
      trialEndsAt: row.trialEndsAt,
      ksefEnv: "test" as const,
    })),
  });
  const bySlug = new Map(created.map((row) => [row.slug, row]));

  const orderStudios = extras.filter((row) => row.firstWeekOrders > 0 || row.recentOrder);
  const clients = await platformDb.client.createManyAndReturn({
    data: orderStudios.map((spec) => ({ studioId: bySlug.get(spec.slug)!.id, name: spec.name })),
  });
  const clientByStudio = new Map(clients.map((row) => [row.studioId, row.id]));
  const vehicles = await platformDb.vehicle.createManyAndReturn({
    data: orderStudios.map((spec) => ({
      studioId: bySlug.get(spec.slug)!.id,
      clientId: clientByStudio.get(bySlug.get(spec.slug)!.id)!,
      make: "Toyota",
      model: "Corolla",
      plate: spec.publicCode.replace("ST-", "WX "),
    })),
  });
  const vehicleByStudio = new Map(vehicles.map((row) => [row.studioId, row.id]));
  const orders = orderStudios.flatMap((spec) => {
    const studioId = bySlug.get(spec.slug)!.id;
    const clientId = clientByStudio.get(studioId)!;
    const vehicleId = vehicleByStudio.get(studioId)!;
    const rows = [];
    for (let n = 0; n < spec.firstWeekOrders; n++) {
      const at = new Date(spec.createdAt.getTime() + (n + 1) * 86_400_000);
      rows.push(orderRow(studioId, clientId, vehicleId, n + 1, at, at));
    }
    if (spec.recentOrder) {
      const at = new Date(now.getTime() - 2 * 86_400_000);
      rows.push(orderRow(studioId, clientId, vehicleId, spec.firstWeekOrders + 1, at, at));
    }
    return rows;
  });
  await platformDb.workOrder.createMany({ data: orders });

  const hosts = extras.map((row) => bySlug.get(row.slug)!);
  await platformDb.subscriptionPayment.createMany({
    data: DEMO_OCTOBER_RECEIPTS.map((amountNet, index) => {
      const studio = hosts[index]!;
      return {
        studioId: studio.id,
        stripeInvoiceId: `in_demo_${studio.publicCode}`,
        amountNet: new Prisma.Decimal(amountNet),
        paidAt: waw("2026-10-15 12:00"),
      };
    }),
  });
  for (const cost of DEMO_OCTOBER_COSTS) {
    await platformDb.platformCost.upsert({
      where: { year_month_category: { year: 2026, month: 10, category: cost.category } },
      update: { amountNet: new Prisma.Decimal(cost.amountNet) },
      create: { year: 2026, month: 10, category: cost.category, amountNet: new Prisma.Decimal(cost.amountNet) },
    });
  }

  return { operatorId: operator.id };
}

function orderRow(studioId: string, clientId: string, vehicleId: string, n: number, from: Date, createdAt: Date) {
  return {
    studioId,
    clientId,
    vehicleId,
    number: `DF-${String(n).padStart(4, "0")}`,
    status: "completed" as const,
    stage: 4,
    service: "Mycie",
    scheduledFrom: from,
    scheduledTo: new Date(from.getTime() + 3_600_000),
    completedAt: createdAt,
    totalGross: new Prisma.Decimal("100.00"),
    createdAt,
    updatedAt: createdAt,
  };
}

function buildExtras(now: Date): Extra[] {
  const rows: Extra[] = [];
  let i = 0;
  const add = (partial: Omit<Extra, "slug" | "publicCode" | "name" | "city">) => {
    i += 1;
    rows.push({
      slug: `${PLATFORM_DEMO.slugPrefix}${String(i).padStart(3, "0")}`,
      publicCode: `ST-D${String(i).padStart(4, "0")}`,
      name: `Studio Demo ${i}`,
      city: CITIES[i % CITIES.length]!,
      ...partial,
    });
  };

  const old = waw("2025-06-01 10:00");
  const octNew = waw("2026-10-08 10:00");
  const convertedCreated = waw("2026-08-20 10:00");
  const convertedEnd = waw("2026-09-03 10:00");
  const convertedActivated = waw("2026-09-03 12:00");
  const churnedAt = waw("2026-10-12 10:00");
  // Zaległe przed 1 października, więc nie wchodzą do bazy churnu (5 / 118 = 4,2%).
  const pastDueAt = waw("2026-09-20 10:00");
  const trialEndSoon = waw("2026-10-28 18:00");
  const trialEndLater = waw("2026-11-08 18:00");
  const expiredEnd = waw("2026-09-15 10:00");

  const activeSpecs: Omit<Extra, "slug" | "publicCode" | "name" | "city">[] = [];
  const pushActive = (plan: Plan, count: number, createdAt: Date, activatedAt: Date, trialEndsAt: Date | null) => {
    for (let n = 0; n < count; n++) {
      activeSpecs.push({
        status: "active",
        plan,
        createdAt,
        activatedAt,
        trialEndsAt,
        updatedAt: now,
        firstWeekOrders: 0,
        recentOrder: false,
      });
    }
  };
  // 9 converted (all solo) + remaining actives. Totals: 64 solo, 47 studio, 16 pro.
  pushActive("solo", 9, convertedCreated, convertedActivated, convertedEnd);
  pushActive("solo", 8, octNew, octNew, null);
  pushActive("studio", 5, octNew, octNew, null);
  pushActive("pro", 2, octNew, octNew, null);
  pushActive("solo", 47, old, old, null);
  pushActive("studio", 42, old, old, null);
  pushActive("pro", 14, old, old, null);
  // 9+8+47=64 solo, 5+42=47 studio, 2+14=16 pro. 9+8+5+2+47+42+14=127.

  activeSpecs.forEach((row, index) => {
    row.firstWeekOrders = index < 24 ? 3 : 0;
    row.recentOrder = index < 111;
    add(row);
  });

  for (let n = 0; n < 24; n++) {
    add({
      status: "trial",
      plan: "studio",
      createdAt: waw("2026-10-16 10:00"),
      activatedAt: null,
      trialEndsAt: n < 3 ? trialEndSoon : trialEndLater,
      updatedAt: now,
      firstWeekOrders: 0,
      recentOrder: false,
    });
  }
  for (let n = 0; n < 6; n++) {
    add({
      status: "past_due",
      plan: "studio",
      createdAt: old,
      activatedAt: old,
      trialEndsAt: null,
      updatedAt: pastDueAt,
      firstWeekOrders: 0,
      recentOrder: false,
    });
  }
  for (let n = 0; n < 8; n++) {
    add({
      status: "suspended",
      plan: "pro",
      createdAt: waw("2025-04-01 10:00"),
      activatedAt: waw("2025-04-01 10:00"),
      trialEndsAt: null,
      updatedAt: waw("2026-08-01 10:00"),
      firstWeekOrders: 0,
      recentOrder: false,
    });
  }
  for (let n = 0; n < 21; n++) {
    add({
      status: "canceled",
      plan: "solo",
      createdAt: waw("2026-08-20 10:00"),
      activatedAt: null,
      trialEndsAt: expiredEnd,
      updatedAt: expiredEnd,
      firstWeekOrders: 0,
      recentOrder: false,
    });
  }
  for (let n = 0; n < 5; n++) {
    add({
      status: "canceled",
      plan: "studio",
      createdAt: old,
      activatedAt: old,
      trialEndsAt: null,
      updatedAt: churnedAt,
      firstWeekOrders: 0,
      recentOrder: false,
    });
  }

  return rows;
}
