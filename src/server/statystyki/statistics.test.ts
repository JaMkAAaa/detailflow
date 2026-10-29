import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import type { OrderStatus } from "../../../lib/db/generated/client";
import { getDashboardMetrics, warsawDate } from "../pulpit/metrics";
import { getStudioStatistics, parseStatisticsRange, statisticsPresets, warsawDay } from "./statistics";

describe("statistics range (Europe/Warsaw)", () => {
  it("defaults to the first of the Warsaw month through today, also just after midnight Warsaw time", () => {
    // 2026-09-30T22:30Z is already 1 Oct 00:30 in Warsaw (CEST).
    const range = parseStatisticsRange({}, new Date("2026-09-30T22:30:00Z"));
    expect([range.from, range.to, range.days]).toEqual(["2026-10-01", "2026-10-01", 1]);
    expect(range.start.toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-01T22:00:00.000Z");
  });
  it("uses Warsaw midnights across both DST changes, so the range may be 23 or 25 hours per day", () => {
    const spring = parseStatisticsRange({ from: "2026-03-29", to: "2026-03-29" });
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3_600_000);
    const autumn = parseStatisticsRange({ from: "2026-10-25", to: "2026-10-25" });
    expect(autumn.end.getTime() - autumn.start.getTime()).toBe(25 * 3_600_000);
    expect(warsawDay(new Date("2026-10-24T22:00:00Z"))).toEqual({ y: 2026, m: 10, d: 25 });
    expect(warsawDay(new Date("2026-12-31T23:30:00Z"))).toEqual({ y: 2027, m: 1, d: 1 });
  });
  it("rejects malformed, impossible, reversed and over-long ranges with 400", () => {
    for (const input of [{ from: "2026-02-30", to: "2026-03-01" }, { from: "26-01-01" }, { from: "2026-01-02", to: "2026-01-01" }, { from: "2025-01-01", to: "2026-01-02" }, { from: "1999-01-01", to: "2000-01-01" }]) {
      expect(() => parseStatisticsRange(input, new Date("2026-10-24T09:30:00Z"))).toThrowError(expect.objectContaining({ status: 400 }));
    }
    expect(parseStatisticsRange({ from: "2025-01-01", to: "2026-01-01" }).days).toBe(366);
  });
  it("builds presets across the year boundary", () => {
    expect(statisticsPresets(new Date("2026-01-15T12:00:00Z")).map(({ from, to }) => [from, to])).toEqual([
      ["2026-01-01", "2026-01-15"], ["2025-12-01", "2025-12-31"], ["2025-11-01", "2026-01-15"],
    ]);
  });
});

describe("studio statistics (Postgres)", () => {
  const tag = randomUUID();
  let a: string;
  let b: string;
  let clientId: string;
  let vehicleId: string;
  let bayOne: string;
  let seq = 0;
  const db = () => studioDb(a);

  async function order(status: OrderStatus, o: { service?: string; gross?: string; completedAt?: Date | null; from?: Date; to?: Date; bayId?: string | null }) {
    return db().workOrder.create({
      data: {
        studioId: a, clientId, vehicleId, number: `ST-${++seq}`, status, stage: 4, service: o.service ?? "Korekta",
        bayId: o.bayId === undefined ? null : o.bayId,
        scheduledFrom: o.from ?? warsawDate(2026, 1, 5, 8), scheduledTo: o.to ?? warsawDate(2026, 1, 5, 9),
        totalGross: o.gross ?? "100.00", completedAt: o.completedAt ?? null,
      },
    });
  }

  beforeAll(async () => {
    const studios = await Promise.all(["a", "b"].map((suffix) => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: `Stats ${suffix}` } })));
    [a, b] = studios.map((studio) => studio.id) as [string, string];
    const client = await db().client.create({ data: { studioId: a, name: "Client" } });
    clientId = client.id;
    vehicleId = (await db().vehicle.create({ data: { studioId: a, clientId, make: "Audi", model: "A4", plate: tag } })).id;
    bayOne = (await db().bay.create({ data: { studioId: a, name: "Boks 01", sort: 1 } })).id;
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it("returns 'brak danych' (null, not zero) for a studio without orders, bays or bookings", async () => {
    const stats = await getStudioStatistics(b, parseStatisticsRange({ from: "2026-10-01", to: "2026-12-31" }));
    expect(stats.revenue).toMatchObject({ hasData: false, totalPln: null, orders: 0 });
    expect(stats.revenue.months).toHaveLength(3);
    expect(stats.revenue.months.every((month) => !month.hasData && month.revenuePln === null)).toBe(true);
    expect(stats.services).toEqual({ hasData: false, orders: 0, rows: [] });
    expect(stats.occupancy).toMatchObject({ hasData: false, percent: null, bays: [] });
  });

  it("sums only completed orders by Warsaw completion instant and splits the months on Warsaw midnight and DST", async () => {
    // Sept 30 23:59:59 Warsaw (CEST) vs Oct 1 00:00:00 Warsaw.
    await order("completed", { gross: "1000.10", completedAt: new Date("2026-09-30T21:59:59Z"), service: "Ceramika" });
    await order("completed", { gross: "0.20", completedAt: new Date("2026-09-30T22:00:00Z"), service: "Ceramika" });
    // 31 Oct 23:59 Warsaw is Oct; 1 Nov 00:00 Warsaw (CET) is Nov.
    await order("completed", { gross: "5.00", completedAt: new Date("2026-10-31T22:59:59Z"), service: "Pranie" });
    await order("completed", { gross: "7.00", completedAt: new Date("2026-10-31T23:00:00Z"), service: "Pranie" });
    // Not revenue: canceled with price and completedAt, active, and `completed` without a date.
    await order("canceled", { gross: "9999.00", completedAt: new Date("2026-10-10T10:00:00Z") });
    await order("in_progress", { gross: "8888.00" });
    await order("ready_for_pickup", { gross: "7777.00" });
    await order("completed", { gross: "6666.00", completedAt: null });
    // Dec has no data: it must not show as 0.
    const stats = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-09-01", to: "2026-12-31" }));
    expect(stats.revenue.months.map(({ key, revenuePln, orders, hasData }) => [key, revenuePln, orders, hasData])).toEqual([
      ["2026-09", "1000.10", 1, true], ["2026-10", "5.20", 2, true], ["2026-11", "7.00", 1, true], ["2026-12", null, 0, false],
    ]);
    expect(stats.revenue.totalPln).toBe("1012.30");
    expect(stats.revenue.orders).toBe(4);
    expect(stats.revenue.months[0]).toMatchObject({ from: "2026-09-01", to: "2026-09-30", partial: false });
    // The range cuts a month: only inside the range counts and the bucket is marked partial.
    const october = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-10-01", to: "2026-10-31" }));
    expect(october.revenue.totalPln).toBe("5.20");
    const partial = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-09-30", to: "2026-10-15" }));
    expect(partial.revenue.months.map((month) => [month.key, month.partial, month.revenuePln])).toEqual([["2026-09", true, "1000.10"], ["2026-10", true, "0.20"]]);
  });

  it("is exact in Decimal and never multiplies by float", async () => {
    const stats = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-09-30", to: "2026-09-30" }));
    expect(stats.revenue.totalPln).toBe("1000.10");
    await order("completed", { gross: "0.10", completedAt: new Date("2026-02-10T10:00:00Z") });
    await order("completed", { gross: "0.20", completedAt: new Date("2026-02-11T10:00:00Z") });
    const sum = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-02-01", to: "2026-02-28" }));
    expect(sum.revenue.totalPln).toBe("0.30");
  });

  it("does not double-count revenue when orders have invoices and corrections", async () => {
    const before = (await getStudioStatistics(a, parseStatisticsRange({ from: "2026-07-01", to: "2026-07-31" }))).revenue;
    expect(before.hasData).toBe(false);
    const paid = await order("completed", { gross: "123.00", completedAt: new Date("2026-07-10T10:00:00Z"), service: "Faktura" });
    const invoice = await db().invoice.create({ data: { studioId: a, workOrderId: paid.id, number: `FV/${tag}/1`, status: "issued", ksefEnv: "test", buyerName: "X", totalNet: "100.00", totalVat: "23.00", totalGross: "123.00" } });
    await db().invoice.create({ data: { studioId: a, workOrderId: paid.id, number: `FV/${tag}/2`, status: "issued", kind: "correction", correctsInvoiceId: invoice.id, ksefEnv: "test", buyerName: "X", totalNet: "-10.00", totalVat: "-2.30", totalGross: "-12.30" } });
    const stats = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-07-01", to: "2026-07-31" }));
    expect(stats.revenue).toMatchObject({ totalPln: "123.00", orders: 1 });
  });

  it("shares services by order label with one order in one row, normalising case/space and rolling up the tail", async () => {
    const range = parseStatisticsRange({ from: "2026-05-01", to: "2026-05-31" });
    const at = new Date("2026-05-10T10:00:00Z");
    for (const [index, [service, gross]] of ([["Korekta", "100.00"], ["korekta ", "50.00"], ["Korekta,  Ceramika", "300.00"], ["Pranie", "50.00"]] as const).entries()) {
      await order("completed", { service, gross, completedAt: new Date(at.getTime() + index * 60_000) });
    }
    await order("canceled", { service: "Anulowane", gross: "500.00", completedAt: at });
    for (let i = 0; i < 8; i++) await order("completed", { service: `Dodatek ${i}`, gross: "0.00", completedAt: at });
    const { services } = await getStudioStatistics(a, range);
    expect(services.orders).toBe(12);
    expect(services.rows).toHaveLength(9);
    expect(services.rows[0]).toMatchObject({ label: "Korekta", orders: 2, orderShare: "16.7", revenuePln: "150.00", revenueShare: "30.0" });
    expect(services.rows.at(-1)).toMatchObject({ label: "Pozostałe usługi" });
    expect(services.rows.reduce((n, row) => n + row.orders, 0)).toBe(12);
    expect(services.rows.reduce((sum, row) => sum + Number(row.revenuePln), 0)).toBeCloseTo(500, 2);
    expect(services.rows.some((row) => row.label === "Anulowane")).toBe(false);
  });

  it("gives no revenue share when the total is 0 zł, but still counts the orders", async () => {
    const stats = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-04-01", to: "2026-04-30" }));
    expect(stats.services.hasData).toBe(false);
    await order("completed", { service: "Gratis", gross: "0.00", completedAt: new Date("2026-04-10T10:00:00Z") });
    const free = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-04-01", to: "2026-04-30" }));
    expect(free.revenue).toMatchObject({ hasData: true, totalPln: "0.00", orders: 1 });
    expect(free.services.rows[0]).toMatchObject({ orderShare: "100.0", revenueShare: null });
  });

  it("measures occupancy in the 08–16 window with the union of overlaps, without canceled orders", async () => {
    const day = (d: number, h: number) => warsawDate(2026, 11, d, h);
    await db().bay.create({ data: { studioId: a, name: "Boks 02", sort: 2 } });
    // Boks 01, 2 Nov: 07–12 ∪ 10–18 ∪ 11–13 = 08–16 (8 h) — overlaps and out-of-hours time counted once.
    await order("completed", { bayId: bayOne, from: day(2, 7), to: day(2, 12), completedAt: warsawDate(2026, 8, 1, 12) });
    await order("accepted", { bayId: bayOne, from: day(2, 10), to: day(2, 18) });
    await order("ready_for_pickup", { bayId: bayOne, from: day(2, 11), to: day(2, 13) });
    // Canceled and outside the range do not count; 3 Nov 08–10 in the same bay counts 2 h.
    await order("canceled", { bayId: bayOne, from: day(3, 12), to: day(3, 16) });
    await order("in_progress", { bayId: bayOne, from: day(3, 8), to: day(3, 10) });
    await order("accepted", { bayId: bayOne, from: day(20, 8), to: day(20, 16) });
    // No bay: it does not occupy a bay.
    await order("in_progress", { bayId: null, from: day(2, 8), to: day(2, 16) });
    const { occupancy } = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-11-02", to: "2026-11-03" }));
    // capacity: 2 bays × 2 days × 8 h = 32 h; booked 8 h + 2 h = 10 h.
    expect(occupancy).toMatchObject({ hasData: true, percent: "31.3", bookedHours: 10, capacityHours: 32, windowLabel: "08:00–16:00" });
    expect(occupancy.bays.map(({ name, percent, bookedHours, capacityHours }) => [name, percent, bookedHours, capacityHours])).toEqual([
      ["Boks 01", "62.5", 10, 16], ["Boks 02", "0.0", 0, 16],
    ]);
  });

  it("counts multi-day bookings per day window and handles the 25 h DST day", async () => {
    // Oct 25, 2026 (25 h): a booking 08:00–16:00 Warsaw is still 8 h; one running Oct 24 12:00 → Oct 26 10:00 gives 4 + 8 + 2 h.
    await order("in_progress", { bayId: bayOne, from: warsawDate(2026, 10, 24, 12), to: warsawDate(2026, 10, 26, 10) });
    const { occupancy } = await getStudioStatistics(a, parseStatisticsRange({ from: "2026-10-24", to: "2026-10-26" }));
    expect(occupancy.bays.find((bay) => bay.id === bayOne)).toMatchObject({ bookedHours: 14, capacityHours: 24, percent: "58.3" });
  });

  it("reports no occupancy data for a range with bays but no bookings", async () => {
    const stats = await getStudioStatistics(a, parseStatisticsRange({ from: "2027-03-01", to: "2027-03-07" }));
    expect(stats.occupancy).toMatchObject({ hasData: false, percent: null, bays: [] });
  });

  it("equals the dashboard revenue for the same Warsaw month", async () => {
    const now = new Date("2026-09-30T21:00:00Z");
    const dashboard = await getDashboardMetrics(a, now);
    const stats = await getStudioStatistics(a, parseStatisticsRange({}, now));
    expect(stats.revenue.totalPln).toBe(dashboard.revenuePln);
  });

  it("isolates two tenants: foreign orders, bays and services never enter the numbers", async () => {
    const other = studioDb(b);
    const foreignClient = await other.client.create({ data: { studioId: b, name: "Obcy" } });
    const foreignVehicle = await other.vehicle.create({ data: { studioId: b, clientId: foreignClient.id, make: "Fiat", model: "Panda", plate: `${tag}-b` } });
    const foreignBay = await other.bay.create({ data: { studioId: b, name: "Obcy boks", sort: 1 } });
    await other.workOrder.create({ data: { studioId: b, clientId: foreignClient.id, vehicleId: foreignVehicle.id, bayId: foreignBay.id, number: "B-1", status: "completed", stage: 4, service: "Obca usługa", scheduledFrom: warsawDate(2026, 11, 2, 8), scheduledTo: warsawDate(2026, 11, 2, 16), totalGross: "99999.99", completedAt: warsawDate(2026, 11, 2, 15) } });
    const range = parseStatisticsRange({ from: "2026-11-02", to: "2026-11-30" });
    const own = await getStudioStatistics(a, range);
    const foreign = await getStudioStatistics(b, range);
    expect(foreign.revenue.totalPln).toBe("99999.99");
    expect(foreign.services.rows.map((row) => row.label)).toEqual(["Obca usługa"]);
    expect(foreign.occupancy.bays.map((bay) => bay.name)).toEqual(["Obcy boks"]);
    expect(own.revenue.totalPln).toBeNull();
    expect(own.services.rows.map((row) => row.label)).not.toContain("Obca usługa");
    expect(own.occupancy.bays.map((bay) => bay.name)).toEqual(["Boks 01", "Boks 02"]);
    expect(JSON.stringify(own)).not.toContain("Obc");
  });
});
