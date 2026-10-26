import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import type { OrderStatus } from "../../../lib/db/generated/client";
import { getDashboardMetrics, warsawDate } from "./metrics";

it("uses Warsaw midnight at month boundaries and on 23/25-hour DST days", () => {
  expect(warsawDate(2026, 10, 1).toISOString()).toBe(
    "2026-09-30T22:00:00.000Z",
  );
  expect(warsawDate(2026, 11, 1).toISOString()).toBe(
    "2026-10-31T23:00:00.000Z",
  );
  expect(
    warsawDate(2026, 3, 30).getTime() - warsawDate(2026, 3, 29).getTime(),
  ).toBe(23 * 3_600_000);
  expect(
    warsawDate(2026, 10, 26).getTime() - warsawDate(2026, 10, 25).getTime(),
  ).toBe(25 * 3_600_000);
});

describe("dashboard metrics (Postgres)", () => {
  const tag = randomUUID();
  const now = new Date("2026-10-24T09:30:00Z");
  let a: string;
  let b: string;
  let completedId: string;
  let clientId: string;
  let vehicleId: string;
  let bayId: string;

  beforeAll(async () => {
    const studios = await Promise.all(
      ["a", "b"].map((suffix) =>
        platformDb.studio.create({
          data: {
            publicCode: `${tag}-${suffix}`,
            slug: `${tag}-${suffix}`,
            name: `Metrics ${suffix}`,
            ksefEnv: "test",
          },
        }),
      ),
    );
    [a, b] = studios.map((s) => s.id) as [string, string];
    const db = studioDb(a);
    const client = await db.client.create({
      data: { studioId: a, name: "Client A", isRegular: true },
    });
    clientId = client.id;
    const otherClient = await db.client.create({
      data: { studioId: a, name: "New client" },
    });
    const otherVehicle = await db.vehicle.create({
      data: {
        studioId: a,
        clientId: otherClient.id,
        make: "Audi",
        model: "Q5",
        plate: `${tag}-2`,
      },
    });
    const vehicle = await db.vehicle.create({
      data: {
        studioId: a,
        clientId,
        make: "Porsche",
        model: "Panamera",
        plate: tag,
      },
    });
    vehicleId = vehicle.id;
    const bay = await db.bay.create({
      data: { studioId: a, name: "Boks 01", sort: 1 },
    });
    bayId = bay.id;
    await db.bay.create({ data: { studioId: a, name: "Boks 02", sort: 2 } });
    let seq = 0;
    async function order(
      status: OrderStatus,
      from: Date,
      to: Date,
      gross = "100.00",
      completedAt: Date | null = null,
      withBay = true,
    ) {
      return db.workOrder.create({
        data: {
          studioId: a,
          clientId,
          vehicleId,
          bayId: withBay ? bayId : null,
          number: `TEST-${++seq}`,
          status,
          stage: 2,
          service: "Test",
          scheduledFrom: from,
          scheduledTo: to,
          totalGross: gross,
          completedAt,
        },
      });
    }
    // Union in Boks 01: 08–16, even with overlapping and out-of-hours bookings.
    await order(
      "in_progress",
      warsawDate(2026, 10, 24, 7),
      warsawDate(2026, 10, 24, 12),
    );
    await order(
      "accepted",
      warsawDate(2026, 10, 24, 10),
      warsawDate(2026, 10, 24, 18),
    );
    await order(
      "ready_for_pickup",
      warsawDate(2026, 10, 24, 11),
      warsawDate(2026, 10, 24, 13),
    );
    await order(
      "in_progress",
      warsawDate(2026, 10, 23, 8),
      warsawDate(2026, 10, 24),
    );
    await order(
      "in_progress",
      warsawDate(2026, 10, 24, 8),
      warsawDate(2026, 10, 24, 16),
      "100.00",
      null,
      false,
    );
    const completed = await order(
      "completed",
      warsawDate(2026, 9, 30, 8),
      warsawDate(2026, 9, 30, 16),
      "0.10",
      warsawDate(2026, 10, 1),
    );
    completedId = completed.id;
    await order(
      "completed",
      warsawDate(2026, 10, 1, 8),
      warsawDate(2026, 10, 1, 16),
      "0.20",
      warsawDate(2026, 10, 24),
    );
    await order(
      "completed",
      warsawDate(2026, 9, 30, 8),
      warsawDate(2026, 9, 30, 16),
      "999.00",
      new Date(warsawDate(2026, 10, 1).getTime() - 1),
    );
    await order(
      "completed",
      warsawDate(2026, 11, 1, 8),
      warsawDate(2026, 11, 1, 16),
      "999.00",
      warsawDate(2026, 11, 1),
    );
    await order(
      "canceled",
      warsawDate(2026, 10, 24, 8),
      warsawDate(2026, 10, 24, 16),
    );
    await db.coatingReminder.createMany({
      data: [
        { studioId: a, vehicleId, dueAt: warsawDate(2026, 10, 1) },
        { studioId: a, vehicleId, dueAt: warsawDate(2026, 10, 31, 23) },
        {
          studioId: a,
          vehicleId: otherVehicle.id,
          dueAt: warsawDate(2026, 11, 1),
        },
        {
          studioId: a,
          vehicleId: otherVehicle.id,
          dueAt: now,
          completedAt: now,
        },
      ],
    });
    for (const ksefEnv of ["test", "production"] as const) {
      await db.invoice.create({
        data: {
          studioId: a,
          number: "FV/1",
          workOrderId: completedId,
          status: "issued",
          ksefStatus: "rejected",
          ksefEnv,
          buyerName: "Client A",
          totalNet: "0.08",
          totalVat: "0.02",
          totalGross: "0.10",
          issuedAt: now,
        },
      });
    }
  });

  afterAll(async () => {
    await platformDb.studio.deleteMany({
      where: { id: { in: [a, b].filter(Boolean) } },
    });
  });

  it("counts only active statuses, sums Decimal revenue in the local month, merges occupancy and selects today's in-progress car in a bay", async () => {
    const data = await getDashboardMetrics(a, now);
    expect(data.revenuePln).toBe("0.30");
    expect(data.active).toEqual({
      total: 5,
      inProgress: 3,
      ready: 1,
      accepted: 1,
    });
    expect(data.occupancy).toEqual({
      percent: 50,
      occupiedHours: 8,
      capacityHours: 16,
    });
    expect(data.returning).toEqual({ percent: 50, regular: 1, total: 2 });
    expect(data.featured).toMatchObject({
      number: "TEST-1",
      stage: 2,
      bay: "Boks 01",
      vehicle: "Porsche Panamera",
    });
    expect(data.todayOrders).toHaveLength(4);
    expect(data.alerts.coatingClients).toBe(1); // distinct clients, not reminders
    expect(data.alerts.rejected).toHaveLength(1);
    expect(data.alerts.rejected[0]?.ksefEnv).toBe("test");
  });

  it("tenant B cannot see tenant A's revenue, orders, bays, clients or alerts", async () => {
    const data = await getDashboardMetrics(b, now);
    expect(data.revenuePln).toBe("0.00");
    expect(data.active.total).toBe(0);
    expect(data.occupancy).toEqual({
      percent: 0,
      occupiedHours: 0,
      capacityHours: 0,
    });
    expect(data.returning).toEqual({ percent: 0, regular: 0, total: 0 });
    expect(data.featured).toBeNull();
    expect(data.todayOrders).toEqual([]);
    expect(data.plan).toEqual({ bays: [], bookings: [] });
    expect(data.alerts).toEqual({ coatingClients: 0, rejected: [] });
  });

  it("follows the studio's selected KSeF environment", async () => {
    await platformDb.studio.update({
      where: { id: a },
      data: { ksefEnv: "production" },
    });
    try {
      const data = await getDashboardMetrics(a, now);
      expect(data.alerts.rejected.map((i) => i.ksefEnv)).toEqual([
        "production",
      ]);
    } finally {
      await platformDb.studio.update({
        where: { id: a },
        data: { ksefEnv: "test" },
      });
    }
  });

  it("does not feature yesterday's car, a car outside a bay, or a ready car", async () => {
    const db = studioDb(a);
    await db.workOrder.updateMany({
      where: { number: "TEST-1" },
      data: { status: "completed", completedAt: now },
    });
    expect((await getDashboardMetrics(a, now)).featured).toBeNull();
  });
});
