import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const now = new Date("2026-10-26T10:30:00.000Z");
const tag = randomUUID();

describe("A-05 bez KSeF TEST (Postgres)", () => {
  let testId = "";
  let prodId = "";

  beforeAll(async () => {
    const { platformDb } = await import("../../../lib/db/client");
    const { studioDb } = await import("../../../lib/db/tenant");
    const testStudio = await platformDb.studio.create({
      data: { publicCode: `${tag}-t`, slug: `${tag}-t`, name: "Test env", status: "active", plan: "solo", activatedAt: new Date("2026-01-01"), ksefEnv: "test" },
    });
    const prodStudio = await platformDb.studio.create({
      data: { publicCode: `${tag}-p`, slug: `${tag}-p`, name: "Prod env", status: "active", plan: "solo", activatedAt: new Date("2026-01-01"), ksefEnv: "production" },
    });
    testId = testStudio.id;
    prodId = prodStudio.id;

    for (const [studioId, env, issuedAt] of [
      [testId, "test", now],
      [prodId, "production", now],
    ] as const) {
      const db = studioDb(studioId);
      const client = await db.client.create({ data: { studioId, name: tag } });
      const vehicle = await db.vehicle.create({
        data: { studioId, clientId: client.id, make: "Fiat", model: "Panda", plate: `${tag}-${env}` },
      });
      const createdAt = env === "test" ? now : new Date("2020-01-01T00:00:00.000Z");
      const order = await db.workOrder.create({
        data: {
          studioId, clientId: client.id, vehicleId: vehicle.id, number: "DF-1", status: "completed",
          service: "Mycie", scheduledFrom: createdAt, scheduledTo: createdAt, totalGross: "100.00",
          createdAt, updatedAt: createdAt,
        },
      });
      await db.invoice.create({
        data: {
          studioId, workOrderId: order.id, number: "FV/1", status: "issued", ksefEnv: env,
          buyerName: tag, issuedAt, totalNet: "5000.00", totalVat: "1150.00", totalGross: "6150.00",
        },
      });
    }
  });

  afterAll(async () => {
    const { platformDb } = await import("../../../lib/db/client");
    await platformDb.studio.deleteMany({ where: { id: { in: [testId, prodId].filter(Boolean) } } });
  });

  it("liczy fakturę PROD i pomija TEST oraz nie zapisuje jej jako wpływu", async () => {
    const { platformDb } = await import("../../../lib/db/client");
    const { featureUsage } = await import("./analytics");
    const { startOfWarsawMonth } = await import("./metrics");
    const usage = await featureUsage([testId, prodId], startOfWarsawMonth(now), now);
    expect(usage.find((feature) => feature.key === "invoices")).toMatchObject({ used: 1, eligible: 2, rate: 0.5 });
    expect(usage.find((feature) => feature.key === "orders")).toMatchObject({ used: 1, eligible: 2, rate: 0.5 });
    expect(await platformDb.subscriptionPayment.count({ where: { studioId: { in: [testId, prodId] } } })).toBe(0);
    expect(await platformDb.invoice.count({ where: { studioId: testId, ksefEnv: "test" } })).toBe(1);
  });
});
