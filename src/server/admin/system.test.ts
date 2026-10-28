import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

import { Prisma } from "@/lib/db/generated/client";
import { platformDb } from "@/lib/db/client";
import { getSystemSnapshot, ksefErrorCounts, type SystemProbes } from "./system";

const tag = randomUUID();
const probes: SystemProbes = {
  database: async () => "ok",
  redis: async () => "down",
  stripe: () => "unconfigured",
  mail: () => "unconfigured",
};
let studioId = "";

afterAll(async () => {
  if (studioId) await platformDb.studio.deleteMany({ where: { id: studioId } });
});

describe("kondycja KSeF", () => {
  it("dolicza TEST i PROD do osobnych mianowników", async () => {
    const before = await getSystemSnapshot(new Date(), probes);
    const studio = await platformDb.studio.create({ data: { name: tag, slug: tag, publicCode: tag } });
    studioId = studio.id;
    const client = await platformDb.client.create({ data: { studioId, name: tag } });
    const vehicle = await platformDb.vehicle.create({
      data: { studioId, clientId: client.id, make: "Test", model: "Auto", plate: tag.slice(0, 12) },
    });
    const order = await platformDb.workOrder.create({
      data: {
        studioId,
        number: "DF-1",
        clientId: client.id,
        vehicleId: vehicle.id,
        status: "completed",
        service: "Test",
        scheduledFrom: new Date("2026-10-24T08:00:00.000Z"),
        scheduledTo: new Date("2026-10-24T10:00:00.000Z"),
        totalGross: new Prisma.Decimal("10.00"),
      },
    });
    const money = { totalNet: "1.00", totalVat: "0.23", totalGross: "1.23", buyerName: tag, status: "issued" as const };
    const accepted = await platformDb.invoice.create({
      data: { ...money, studioId, workOrderId: order.id, number: "FV/1", ksefEnv: "test", ksefStatus: "accepted" },
    });
    const rejected = await platformDb.invoice.create({
      data: { ...money, studioId, workOrderId: order.id, number: "FV/2", ksefEnv: "test", ksefStatus: "rejected" },
    });
    await platformDb.invoice.create({
      data: { ...money, studioId, workOrderId: order.id, number: "FV/1", ksefEnv: "production", ksefStatus: "accepted" },
    });
    await platformDb.invoice.create({
      data: { ...money, studioId, workOrderId: order.id, number: "FV/9", ksefEnv: "test", ksefStatus: "not_sent" },
    });
    await platformDb.ksefEvent.create({
      data: { studioId, invoiceId: rejected.id, kind: "rejected", at: new Date(), message: `NIP ${tag}` },
    });
    const after = await getSystemSnapshot(new Date(), probes);
    expect(after.ksef.test.accepted - before.ksef.test.accepted).toBe(1);
    expect(after.ksef.test.rejected - before.ksef.test.rejected).toBe(1);
    expect(after.ksef.test.total - before.ksef.test.total).toBe(2);
    expect(after.ksef.production.accepted - before.ksef.production.accepted).toBe(1);
    expect(after.ksef.production.total - before.ksef.production.total).toBe(1);
    expect(after.ksef.test.total - before.ksef.test.total).not.toBe(after.ksef.production.accepted - before.ksef.production.accepted + 2);
    const testErrors = await ksefErrorCounts("test");
    const prodErrors = await ksefErrorCounts("production");
    expect(testErrors.some((row) => row.message === `NIP ${tag}`)).toBe(true);
    expect(prodErrors.some((row) => row.message === `NIP ${tag}`)).toBe(false);
    expect(accepted.ksefEnv).toBe("test");
  });
});
