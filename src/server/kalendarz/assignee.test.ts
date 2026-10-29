import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { POST as createOrderRoute } from "../../../app/api/studios/[studioId]/orders/route";
import { POST as bookingPost, PUT as bookingPut } from "../../../app/api/studios/[studioId]/bookings/[workOrderId]/route";
import { changeMember } from "../studio/members";
import { BookingError, listBookings, serializableBooking } from "./booking";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

const tag = randomUUID();
const context = (studioId: string, workOrderId = "none") => ({ params: Promise.resolve({ studioId, workOrderId }) });
const request = (method: string, data?: unknown) => new Request("http://localhost:3000/api/studios/x", {
  method, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});

describe("assignee, calendar-created orders and tenant isolation (Postgres)", () => {
  const studios: string[] = [];
  const bays: string[] = [];
  const clients: string[] = [];
  const vehicles: string[] = [];
  const users: Record<"owner" | "worker" | "outsider", string> = { owner: "", worker: "", outsider: "" };
  const order = (i = 0, from = "2026-10-27T10:00", to = "2026-10-27T12:00", extra: object = {}) => ({
    clientId: clients[i]!, vehicleId: vehicles[i]!, service: "Korekta", totalGross: "100.00", scheduledFrom: from, scheduledTo: to, ...extra,
  });
  const newWorkOrder = async (studioId: string, i: number, number: string) => (await studioDb(studioId).workOrder.create({ data: {
    studioId, clientId: clients[i]!, vehicleId: vehicles[i]!, number, status: "accepted", service: "Mycie",
    scheduledFrom: new Date("2026-11-02T08:00Z"), scheduledTo: new Date("2026-11-02T09:00Z"), totalGross: "10.00",
  } })).id;

  beforeAll(async () => {
    for (const role of ["owner", "worker", "outsider"] as const) {
      users[role] = (await platformDb.user.create({ data: { name: role, email: `${tag}-${role}@example.test` } })).id;
    }
    for (const suffix of ["a", "b"]) {
      const studioId = (await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, status: "active" } })).id;
      studios.push(studioId);
      const db = studioDb(studioId);
      bays.push((await db.bay.create({ data: { studioId, name: "Boks 01", sort: 1 } })).id);
      const client = await db.client.create({ data: { studioId, name: tag } });
      clients.push(client.id);
      vehicles.push((await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Fiat", model: "Panda", plate: tag } })).id);
    }
    await studioDb(studios[0]!).membership.createMany({ data: [
      { studioId: studios[0]!, userId: users.owner, role: "owner" }, { studioId: studios[0]!, userId: users.worker, role: "worker" },
    ] });
    await studioDb(studios[1]!).membership.create({ data: { studioId: studios[1]!, userId: users.outsider, role: "worker" } });
    mocks.session.mockResolvedValue({ user: { id: users.owner } });
  });
  afterAll(async () => {
    await platformDb.auditLog.deleteMany({ where: { studioId: { in: studios } } });
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
  });

  it("creates an order from a free window with bay, hours and an optional assignee", async () => {
    const a = studios[0]!;
    const withWorker = await createOrderRoute(request("POST", order(0, "2026-10-27T10:00", "2026-10-27T12:00", { bayId: bays[0], assigneeId: users.worker })), context(a));
    expect(withWorker.status).toBe(201);
    expect(await withWorker.json()).toMatchObject({ bayId: bays[0], assigneeId: users.worker, scheduledFrom: "2026-10-27T09:00:00.000Z" });
    const unassigned = await createOrderRoute(request("POST", order(0, "2026-10-27T12:00", "2026-10-27T13:00", { bayId: bays[0], assigneeId: null })), context(a));
    expect(unassigned.status).toBe(201); // adjacent window, half-open interval
    expect(await unassigned.json()).toMatchObject({ bayId: bays[0], assigneeId: null });
    const plain = await createOrderRoute(request("POST", order(0)), context(a));
    expect(plain.status).toBe(201);
    expect(await plain.json()).toMatchObject({ bayId: null, assigneeId: null });
    expect((await listBookings(a)).map((o) => o.assigneeId).sort()).toEqual([null, users.worker].sort());
  });

  it("returns 409 for an overlapping window and keeps the second order out of the database", async () => {
    const a = studios[0]!, db = studioDb(a), before = await db.workOrder.count();
    const clash = await createOrderRoute(request("POST", order(0, "2026-10-27T11:00", "2026-10-27T13:00", { bayId: bays[0] })), context(a));
    expect(clash.status).toBe(409);
    expect((await clash.json()).error).toMatch(/zajęty/);
    expect(await db.workOrder.count()).toBe(before);
  });

  it("lets exactly one of two simultaneous overlapping creates win the bay", async () => {
    const a = studios[0]!, db = studioDb(a);
    const from = "2026-10-29T10:00", to = "2026-10-29T12:00";
    const responses = await Promise.all([1, 2].map(() => createOrderRoute(request("POST", order(0, from, to, { bayId: bays[0] })), context(a))));
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await db.workOrder.count({ where: { bayId: bays[0], scheduledFrom: new Date("2026-10-29T09:00:00Z") } })).toBe(1);
    // The same hours in another studio's bay are independent; a foreign bay is a plain 404.
    mocks.session.mockResolvedValue({ user: { id: users.outsider } });
    try {
      expect((await createOrderRoute(request("POST", order(1, from, to, { bayId: bays[1] })), context(studios[1]!))).status).toBe(201);
      expect((await createOrderRoute(request("POST", order(1, "2026-10-30T10:00", "2026-10-30T11:00", { bayId: bays[0] })), context(studios[1]!))).status).toBe(404);
    } finally { mocks.session.mockResolvedValue({ user: { id: users.owner } }); }
  });

  it("rejects an assignee from another studio with 404 on create, POST and PUT; nothing is written", async () => {
    const a = studios[0]!, db = studioDb(a), before = await db.workOrder.count();
    const create = await createOrderRoute(request("POST", order(0, "2026-11-03T10:00", "2026-11-03T11:00", { assigneeId: users.outsider })), context(a));
    expect(create.status).toBe(404);
    expect(await db.workOrder.count()).toBe(before);
    const id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-1`);
    const slot = { bayId: bays[0], scheduledFrom: "2026-11-04T10:00", scheduledTo: "2026-11-04T11:00" };
    expect((await bookingPost(request("POST", { ...slot, assigneeId: users.outsider }), context(a, id))).status).toBe(404);
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ bayId: null, assigneeId: null });
    expect((await bookingPost(request("POST", { ...slot, assigneeId: users.worker }), context(a, id))).status).toBe(201);
    for (const assigneeId of [users.outsider, "missing-user"]) {
      expect((await bookingPut(request("PUT", { ...slot, assigneeId }), context(a, id))).status).toBe(404);
    }
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ assigneeId: users.worker });
  });

  it("changes, keeps and clears the assignee through the booking API", async () => {
    const a = studios[0]!, db = studioDb(a), id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-2`);
    const slot = { bayId: bays[0], scheduledFrom: "2026-11-05T10:00", scheduledTo: "2026-11-05T11:00" };
    expect(await (await bookingPost(request("POST", { ...slot, assigneeId: users.owner }), context(a, id))).json()).toMatchObject({ assigneeId: users.owner, assignee: { user: { name: "owner" } } });
    expect(await (await bookingPut(request("PUT", { ...slot, scheduledTo: "2026-11-05T12:00" }), context(a, id))).json()).toMatchObject({ assigneeId: users.owner });
    expect(await (await bookingPut(request("PUT", { ...slot, assigneeId: null }), context(a, id))).json()).toMatchObject({ assigneeId: null, assignee: null });
    expect((await bookingPut(request("PUT", { ...slot, assigneeId: "" }), context(a, id))).status).toBe(400);
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ assigneeId: null });
  });

  it("enforces the studio boundary in the database, not only in the service", async () => {
    const a = studios[0]!, id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-3`);
    await expect(studioDb(a).workOrder.update({ where: { id }, data: { assigneeId: users.outsider } })).rejects.toThrow();
    await expect(platformDb.workOrder.update({ where: { id }, data: { assigneeId: "missing-user" } })).rejects.toThrow();
    await expect(platformDb.workOrder.update({ where: { id }, data: { assigneeId: users.worker } })).resolves.toMatchObject({ assigneeId: users.worker });
    await expect(serializableBooking(studioDb(a), (tx) => tx.workOrder.update({ where: { id }, data: { assigneeId: users.outsider } })))
      .rejects.toMatchObject({ status: 404 } satisfies Partial<BookingError>);
    expect(await studioDb(a).workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ assigneeId: users.worker });
  });

  it("does not move a completed order, leaving bay, hours and assignee intact", async () => {
    const a = studios[0]!, db = studioDb(a), id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-4`);
    const slot = { bayId: bays[0], scheduledFrom: "2026-11-06T10:00", scheduledTo: "2026-11-06T11:00" };
    expect((await bookingPost(request("POST", { ...slot, assigneeId: users.worker }), context(a, id))).status).toBe(201);
    await db.workOrder.update({ where: { id }, data: { status: "completed", stage: 4, completedAt: new Date() } });
    for (const patch of [{ scheduledFrom: "2026-11-07T10:00", scheduledTo: "2026-11-07T11:00" }, { assigneeId: users.owner }]) {
      expect((await bookingPut(request("PUT", { ...slot, ...patch }), context(a, id))).status).toBe(409);
    }
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({
      bayId: bays[0], assigneeId: users.worker, scheduledFrom: new Date("2026-11-06T09:00:00Z"), scheduledTo: new Date("2026-11-06T10:00:00Z"),
    });
  });

  it("does not accept the demo quote slot as a reservation", async () => {
    const a = studios[0]!, db = studioDb(a), before = await db.workOrder.count();
    for (const slotId of ["oct24", "oct26"]) {
      expect((await createOrderRoute(request("POST", order(0, "2026-11-08T10:00", "2026-11-08T11:00", { slotId })), context(a))).status).toBe(400);
    }
    const id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-5`);
    const slot = { bayId: bays[0], scheduledFrom: "2026-11-08T10:00", scheduledTo: "2026-11-08T11:00" };
    expect((await bookingPost(request("POST", { ...slot, slotId: "oct24" }), context(a, id))).status).toBe(400);
    expect(await db.workOrder.count()).toBe(before + 1);
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ bayId: null });
  });

  it("removing a member unassigns their orders and keeps the orders", async () => {
    const a = studios[0]!, db = studioDb(a), id = await newWorkOrder(a, 0, `DF-${tag.slice(0, 6)}-6`);
    await platformDb.workOrder.update({ where: { id }, data: { assigneeId: users.worker, status: "completed", stage: 4, completedAt: new Date() } });
    const membership = await db.membership.findFirstOrThrow({ where: { userId: users.worker } });
    await changeMember(users.owner, a, membership.id);
    expect(await db.membership.findFirst({ where: { userId: users.worker } })).toBeNull();
    expect(await db.workOrder.findFirstOrThrow({ where: { id } })).toMatchObject({ assigneeId: null, status: "completed" });
    // A removed member can no longer be assigned.
    expect((await createOrderRoute(request("POST", order(0, "2026-11-09T10:00", "2026-11-09T11:00", { assigneeId: users.worker })), context(a))).status).toBe(404);
  });
});
