import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateMrr } from "../billing/mrr";
import { activationRate, formatRate, trialConversion, trialCount, wasPayingAt, type StudioSnapshot } from "./metrics";

const now = new Date("2026-10-26T10:30:00.000Z");

describe("definicje A-01 (audit/admin)", () => {
  it("nie liczy trialu, past_due i suspended w MRR, a 64×79+48×149+16×279 = 16 672", () => {
    const studios = [
      ...Array.from({ length: 64 }, () => ({ status: "active" as const, plan: "solo" as const })),
      ...Array.from({ length: 48 }, () => ({ status: "active" as const, plan: "studio" as const })),
      ...Array.from({ length: 16 }, () => ({ status: "active" as const, plan: "pro" as const })),
      ...Array.from({ length: 24 }, () => ({ status: "trial" as const, plan: "studio" as const })),
      ...Array.from({ length: 6 }, () => ({ status: "past_due" as const, plan: "studio" as const })),
      ...Array.from({ length: 8 }, () => ({ status: "suspended" as const, plan: "pro" as const })),
    ];
    expect(calculateMrr(studios).toFixed(2)).toBe("16672.00");
  });

  it("konwersja = płatne / zakończone triale, nie / bieżące", () => {
    const studios = [
      ...Array.from({ length: 24 }, () => ({ status: "trial" as const, trialEndsAt: new Date("2026-11-08") })),
      ...Array.from({ length: 9 }, () => ({ status: "active" as const, trialEndsAt: new Date("2026-09-03") })),
      ...Array.from({ length: 21 }, () => ({ status: "canceled" as const, trialEndsAt: new Date("2026-09-15") })),
    ];
    expect(trialCount(studios, now)).toBe(24);
    expect(trialConversion(studios, now)).toEqual({ paid: 9, completed: 30, rate: 0.3 });
  });

  it("aktywacja wymaga pełnego okna 7 dni i trzech zleceń", () => {
    const old = new Date("2026-09-01T00:00:00.000Z");
    const fresh = new Date(now.getTime() - 2 * 86_400_000);
    const studios = [
      { id: "a", createdAt: old },
      { id: "b", createdAt: old },
      { id: "c", createdAt: fresh },
    ];
    const orders = new Map([["a", 3], ["b", 2], ["c", 5]]);
    expect(activationRate(studios, orders, now)).toEqual({ activated: 1, eligible: 2, rate: 0.5 });
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.3)).toBe("30%");
  });

  it("historyczne MRR pomija studio, które odeszło przed datą", () => {
    const snapshot = (over: Partial<StudioSnapshot>): StudioSnapshot => ({
      id: "s",
      name: "S",
      publicCode: "ST-1",
      status: "canceled",
      plan: "studio",
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2026-10-12"),
      activatedAt: new Date("2025-01-01"),
      trialEndsAt: null,
      ...over,
    });
    expect(wasPayingAt(snapshot({}), new Date("2026-09-30"))).toBe(true);
    expect(wasPayingAt(snapshot({}), new Date("2026-10-13"))).toBe(false);
    expect(wasPayingAt(snapshot({ status: "trial", activatedAt: null }), new Date("2026-09-30"))).toBe(false);
  });
});

describe("getPlatformOverview (Postgres)", () => {
  const tag = randomUUID();
  let payingId = "";
  let trialId = "";

  beforeAll(async () => {
    const { platformDb } = await import("../../../lib/db/client");
    const { studioDb } = await import("../../../lib/db/tenant");
    const paying = await platformDb.studio.create({
      data: { publicCode: `${tag}-a`, slug: `${tag}-a`, name: "Paying", status: "active", plan: "solo", activatedAt: new Date("2026-01-01") },
    });
    const trial = await platformDb.studio.create({
      data: { publicCode: `${tag}-b`, slug: `${tag}-b`, name: "Trial", status: "trial", plan: "solo", trialEndsAt: new Date("2026-11-08") },
    });
    payingId = paying.id;
    trialId = trial.id;
    const db = studioDb(paying.id);
    const client = await db.client.create({ data: { studioId: paying.id, name: tag } });
    const vehicle = await db.vehicle.create({ data: { studioId: paying.id, clientId: client.id, make: "Fiat", model: "Panda", plate: tag } });
    await db.workOrder.create({
      data: {
        studioId: paying.id, clientId: client.id, vehicleId: vehicle.id, number: "DF-1", status: "completed",
        service: "Mycie", scheduledFrom: now, scheduledTo: now, completedAt: now, totalGross: "100", createdAt: now, updatedAt: now,
      },
    });
  });

  afterAll(async () => {
    const { platformDb } = await import("../../../lib/db/client");
    await platformDb.studio.deleteMany({ where: { id: { in: [payingId, trialId].filter(Boolean) } } });
  });

  it("sumuje oba studia, ale MRR pomija trial", async () => {
    const { platformDb } = await import("../../../lib/db/client");
    const { getPlatformOverview } = await import("./overview");
    const data = await getPlatformOverview(now);
    expect(data.studioTotal).toBeGreaterThanOrEqual(2);
    const ours = await platformDb.studio.findMany({ where: { id: { in: [payingId, trialId] } } });
    expect(calculateMrr(ours).toFixed(2)).toBe("79.00");
  });
});
