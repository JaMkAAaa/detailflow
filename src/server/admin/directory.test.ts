import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

import { platformDb } from "@/lib/db/client";
import { Prisma } from "@/lib/db/generated/client";
import { getStudioCard, listStudios, studiosCsv } from "./directory";

const tag = randomUUID();
const ids: string[] = [];
let actorId: string;
let activeCode: string;

beforeAll(async () => {
  actorId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
  const specs = [
    { suffix: "active", status: "active" as const, plan: "solo" as const, stripe: true },
    { suffix: "active-2", status: "active" as const, plan: "pro" as const, stripe: true },
    { suffix: "trial", status: "trial" as const, plan: "solo" as const, stripe: false },
    { suffix: "due", status: "past_due" as const, plan: "studio" as const, stripe: true },
    { suffix: "hold", status: "suspended" as const, plan: "studio" as const, stripe: true },
    { suffix: "cancel", status: "canceled" as const, plan: "solo" as const, stripe: true },
  ];
  for (const spec of specs) {
    const code = `${tag}-${spec.suffix}`;
    const studio = await platformDb.studio.create({
      data: {
        name: `${tag} ${spec.suffix}`,
        slug: code,
        publicCode: code,
        status: spec.status,
        plan: spec.plan,
        city: "Kraków",
        phone: "+48 500 000 100",
        stripeCustomerId: spec.stripe ? `cus_${code}` : null,
        stripeSubscriptionId: spec.stripe ? `sub_${code}` : null,
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    ids.push(studio.id);
    if (spec.suffix === "active") activeCode = studio.publicCode;
  }
  const studioId = ids[0]!;
  await platformDb.membership.create({ data: { studioId, userId: actorId, role: "owner" } });
  const client = await platformDb.client.create({ data: { studioId, name: tag } });
  const vehicle = await platformDb.vehicle.create({
    data: { studioId, clientId: client.id, make: "Test", model: "Auto", plate: tag.slice(0, 12) },
  });
  await platformDb.workOrder.create({
    data: {
      studioId,
      number: "DF-1",
      clientId: client.id,
      vehicleId: vehicle.id,
      status: "accepted",
      service: "Test",
      scheduledFrom: new Date("2026-10-24T08:00:00.000Z"),
      scheduledTo: new Date("2026-10-24T10:00:00.000Z"),
      totalGross: new Prisma.Decimal("10.00"),
    },
  });
  await platformDb.auditLog.create({ data: { studioId, action: "studio.created", meta: {} } });
});

afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: ids } } });
  await platformDb.studio.deleteMany({ where: { id: { in: ids } } });
  await platformDb.user.deleteMany({ where: { id: actorId } });
});

describe("katalog studiów (Postgres)", () => {
  it("trzyma filtry rozłączne, a suma obejmuje anulowane jako wstrzymane", async () => {
    const page = await listStudios({ q: tag, filter: "all", page: 1 });
    expect(page.counts).toEqual({ all: 6, active: 2, trial: 1, past_due: 1, suspended: 2 });
    expect(page.counts.active + page.counts.trial + page.counts.past_due + page.counts.suspended).toBe(page.counts.all);
    expect(page.rows[0]?.publicCode).toBe(activeCode);
    expect(page.rows[0]?.lastActivityAt.getTime()).toBeGreaterThan(new Date("2021-01-01").getTime());

    const held = await listStudios({ q: tag, filter: "suspended", page: 1 });
    expect(held.total).toBe(2);
    expect(held.counts.all).toBe(6);
    expect(held.rows.map((row) => row.status).sort()).toEqual(["canceled", "suspended"]);
    expect(held.rows.every((row) => row.subscriptionNet !== null)).toBe(true);

    const trial = await listStudios({ q: tag, filter: "trial", page: 1 });
    expect(trial.rows).toHaveLength(1);
    expect(trial.rows[0]?.subscriptionNet).toBeNull();
    expect(trial.rows[0]?.stripeCustomerId).toBeNull();
  });

  it("eksportuje CSV tylko z bieżącego filtra i szukania", async () => {
    const csv = await studiosCsv({ q: tag, filter: "past_due", page: 1 });
    expect(csv).toContain("Zaległe");
    expect(csv).toContain(`cus_${tag}-due`);
    expect(csv).not.toContain("Aktywne");
    expect(csv).toContain("149.00");
  });

  it("karta ma kontakt, limity i Stripe, a podgląd ląduje w audycie poza listą zdarzeń", async () => {
    const card = await getStudioCard(activeCode, actorId);
    expect(card).toMatchObject({
      publicCode: activeCode,
      stripeCustomerId: `cus_${activeCode}`,
      stripeSubscriptionId: `sub_${activeCode}`,
      subscriptionNet: "79.00",
      ownerEmail: `${tag}@example.com`,
      limits: { users: { used: 1, max: 1 }, bays: { used: 0, max: 1 } },
    });
    expect(card?.events.map((event) => event.label)).toEqual(["Konto utworzone"]);
    expect(await platformDb.auditLog.count({ where: { studioId: ids[0], action: "platform.studio.view" } })).toBe(1);
    expect(await getStudioCard(`${tag}-missing`, actorId)).toBeNull();
  });
});
