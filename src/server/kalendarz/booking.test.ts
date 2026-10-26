import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { bookingSchema, deleteBooking, getBooking, listBookings, overlaps, saveBooking } from "./booking";
import { DELETE, GET, POST, PUT } from "../../../app/api/studios/[studioId]/bookings/[workOrderId]/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const input = (bayId = "bay", from = "2026-10-27T10:00", to = "2026-10-27T12:00") => ({ bayId, scheduledFrom: from, scheduledTo: to });

describe("overlap and Warsaw dates", () => {
  const date = (hour: number) => new Date(Date.UTC(2026, 9, 27, hour));
  it.each([[10, 12, true], [9, 11, true], [11, 13, true], [9, 13, true], [10, 11, true], [8, 10, false], [12, 14, false]])("10–12 vs %s–%s => %s", (from, to, expected) => {
    expect(overlaps(date(10), date(12), date(from as number), date(to as number))).toBe(expected);
  });
  it("uses Warsaw summer/winter offsets independently of the host TZ", () => {
    expect(bookingSchema.parse(input()).scheduledFrom.toISOString()).toBe("2026-10-27T09:00:00.000Z");
    expect(bookingSchema.parse(input("b", "2026-07-01T10:00", "2026-07-01T12:00")).scheduledFrom.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(bookingSchema.parse(input("b", "2026-10-25T02:00:00+02:00", "2026-10-25T02:00:00+01:00")).scheduledTo.toISOString()).toBe("2026-10-25T01:00:00.000Z");
  });
  it.each([
    input("b", "2026-03-29T02:30", "2026-03-29T04:00"),
    input("b", "2026-10-25T02:30", "2026-10-25T04:00"),
    input("b", "2026-02-30T10:00", "2026-03-01T12:00"),
    input("b", "invalid", "2026-10-27T12:00"),
    input("b", "2026-10-27T12:00", "2026-10-27T10:00"),
    input("b", "2026-10-27T10:00", "2026-10-27T10:00"),
    input(""),
  ])("rejects invalid, empty, reversed and ambiguous input %#", (value) => {
    expect(bookingSchema.safeParse(value).success).toBe(false);
  });
});

describe("bookings and tenant isolation (Postgres)", () => {
  const tag = randomUUID();
  const studios: string[] = [];
  const bays: string[][] = [];
  const orders: string[][] = [];
  let userId: string;
  beforeAll(async () => {
    userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
    for (const suffix of ["a", "b"]) {
      const studioId = (await platformDb.studio.create({ data: { name: tag, publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}` } })).id;
      studios.push(studioId);
      const db = studioDb(studioId);
      await db.membership.create({ data: { studioId, userId, role: "worker" } });
      const client = await db.client.create({ data: { studioId, name: tag } });
      const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Fiat", model: "Panda", plate: tag } });
      const localBays: string[] = [];
      const localOrders: string[] = [];
      for (let i = 0; i < 2; i++) localBays.push((await db.bay.create({ data: { studioId, name: `Boks 0${i + 1}`, sort: i } })).id);
      for (let i = 0; i < 8; i++) localOrders.push((await db.workOrder.create({ data: {
        studioId, clientId: client.id, vehicleId: vehicle.id, number: `DF-${i}`, status: "accepted", service: "Mycie",
        scheduledFrom: new Date("2026-10-27T08:00Z"), scheduledTo: new Date("2026-10-27T09:00Z"), totalGross: "123.00",
      } })).id);
      bays.push(localBays); orders.push(localOrders);
    }
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    if (userId) await platformDb.user.delete({ where: { id: userId } });
  });
  const context = (studioId: string, workOrderId: string) => ({ params: Promise.resolve({ studioId, workOrderId }) });
  const request = (method: string, data?: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/studios/bookings", {
    method, headers: { origin, "content-type": "application/json" }, ...(data ? { body: JSON.stringify(data) } : {}),
  });

  it("creates, reads, updates, deletes; returns 409 for the same bay and allows another bay or adjacent slot", async () => {
    const a = studios[0]!, bay = bays[0]![0]!, otherBay = bays[0]![1]!, [first, second, third] = orders[0]!;
    mocks.session.mockResolvedValue({ user: { id: userId } });
    expect((await POST(request("POST", input(bay)), context(a, first!))).status).toBe(201);
    expect((await POST(request("POST", input(bay)), context(a, second!))).status).toBe(409);
    expect((await POST(request("POST", input(otherBay)), context(a, second!))).status).toBe(201);
    expect((await POST(request("POST", input(bay, "2026-10-27T12:00", "2026-10-27T13:00")), context(a, third!))).status).toBe(201);
    expect((await GET(request("GET"), context(a, first!))).status).toBe(200);
    expect((await PUT(request("PUT", input(bay)), context(a, first!))).status).toBe(200); // exclude self
    expect((await PUT(request("PUT", input(otherBay)), context(a, first!))).status).toBe(409);
    expect((await DELETE(request("DELETE"), context(a, first!))).status).toBe(204);
    expect((await studioDb(a).workOrder.findUniqueOrThrow({ where: { id: first! } })).bayId).toBeNull();
    expect((await GET(request("GET"), context(a, first!))).status).toBe(404);
  });
  it("scopes reads, creates, updates and deletes; foreign bay and foreign order match missing IDs", async () => {
    const a = studios[0]!, b = studios[1]!, orderB = orders[1]![0]!, bayB = bays[1]![0]!;
    await saveBooking(b, orderB, input(bayB), "create");
    expect((await listBookings(a)).every((o) => o.id !== orderB)).toBe(true);
    for (const id of [orderB, "missing"]) {
      await expect(getBooking(a, id)).rejects.toMatchObject({ status: 404 });
      await expect(saveBooking(a, id, input(bays[0]![0]!), "create")).rejects.toMatchObject({ status: 404 });
      await expect(saveBooking(a, id, input(bays[0]![0]!), "update")).rejects.toMatchObject({ status: 404 });
      await expect(deleteBooking(a, id)).rejects.toMatchObject({ status: 404 });
    }
    await expect(saveBooking(a, orders[0]![3]!, input(bayB), "create")).rejects.toMatchObject({ status: 404 });
    expect((await getBooking(b, orderB)).bayId).toBe(bayB);
    // The other studio's reservation does not cause a collision.
    await expect(saveBooking(a, orders[0]![3]!, input(bays[0]![0]!), "create")).resolves.toBeDefined();
  });
  it("serializes concurrent colliding writes: exactly one succeeds", async () => {
    const a = studios[0]!, data = input(bays[0]![0]!, "2026-10-28T10:00", "2026-10-28T12:00");
    const results = await Promise.allSettled([4, 5].map((i) => saveBooking(a, orders[0]![i]!, data, "create")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
  });
  it("does not reserve canceled/completed orders; canceled bookings free capacity", async () => {
    const a = studios[0]!, db = studioDb(a), order = orders[0]![6]!;
    for (const status of ["completed", "canceled"] as const) {
      await db.workOrder.update({ where: { id: order }, data: { status } });
      await expect(saveBooking(a, order, input(bays[0]![0]!), "create")).rejects.toMatchObject({ status: 409 });
    }
    await db.workOrder.update({ where: { id: orders[0]![3]! }, data: { status: "canceled" } });
    await expect(saveBooking(a, orders[0]![7]!, input(bays[0]![0]!), "create")).resolves.toBeDefined();
  });
  it("requires a session, studio membership, origin and valid input", async () => {
    const ctx = context(studios[0]!, orders[0]![0]!);
    mocks.session.mockResolvedValue(null);
    expect((await GET(request("GET"), ctx)).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: "not-a-member" } });
    expect((await GET(request("GET"), ctx)).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { id: userId } });
    expect((await POST(request("POST", input(), "https://evil.example"), ctx)).status).toBe(403);
    expect((await POST(request("POST", input("")), ctx)).status).toBe(400);
  });
});
