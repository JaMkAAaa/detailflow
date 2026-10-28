import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { GET as list, POST as create } from "../../../app/api/studios/[studioId]/orders/route";
import { GET as get } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/route";
import { POST as status } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/status/route";
import { POST as advance } from "../../../app/api/studios/[studioId]/orders/[workOrderId]/advance/route";
import { createOrder } from "./orders";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const context = (studioId: string, workOrderId = "missing") => ({ params: Promise.resolve({ studioId, workOrderId }) });
const request = (method = "GET", data?: unknown, origin: string | null = "http://localhost:3000") => new Request("http://localhost:3000/api/studios/orders", {
  method, headers: { ...(origin === null ? {} : { origin }), "content-type": "application/json" },
  ...(data === undefined ? {} : { body: JSON.stringify(data) }),
});

describe("orders HTTP (Postgres)", () => {
  const tag = randomUUID();
  const studios: string[] = [];
  const clients: string[] = [];
  const vehicles: string[] = [];
  let userId: string;
  const input = (i = 0) => ({ clientId: clients[i]!, vehicleId: vehicles[i]!, service: "Korekta", totalGross: "1234.56", scheduledFrom: "2026-10-27T10:00", scheduledTo: "2026-10-27T12:00" });
  const newOrder = async (i = 0) => {
    const response = await create(request("POST", input(i)), context(studios[i]!));
    expect(response.status).toBe(201);
    return response.json();
  };
  beforeAll(async () => {
    userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.test` } })).id;
    mocks.session.mockResolvedValue({ user: { id: userId } });
    for (const suffix of ["a", "b"]) {
      const studioId = (await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, status: "active" } })).id;
      studios.push(studioId);
      const db = studioDb(studioId);
      await db.membership.create({ data: { studioId, userId, role: "worker" } });
      const client = await db.client.create({ data: { studioId, name: tag } });
      clients.push(client.id);
      vehicles.push((await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Fiat", model: "Panda", plate: tag } })).id);
    }
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    if (userId) await platformDb.user.delete({ where: { id: userId } });
  });

  it("allocates distinct numbers for simultaneous HTTP creates with a missing counter", async () => {
    const orders = await Promise.all([newOrder(), newOrder()]);
    expect(orders.map((o) => o.number).sort()).toEqual(["DF-0001", "DF-0002"]);
    for (const order of orders) {
      expect(order).toMatchObject({ status: "accepted", stage: 1, totalGross: "1234.56", scheduledFrom: "2026-10-27T09:00:00.000Z", scheduledTo: "2026-10-27T11:00:00.000Z", completedAt: null });
      expect(await studioDb(studios[0]!).workOrderEvent.findMany({ where: { workOrderId: order.id } })).toMatchObject([
        { actorId: userId, fromStatus: null, fromStage: null, toStatus: "accepted", toStage: 1 },
      ]);
    }
    expect((await newOrder(1)).number).toBe("DF-0001");
  });

  it("rolls back both the order and the counter if creation history fails", async () => {
    const db = studioDb(studios[0]!);
    const before = await db.workOrder.count();
    const counter = await db.orderCounter.findUniqueOrThrow({ where: { studioId: studios[0]! } });
    await expect(createOrder(db, studios[0]!, "nonexistent-actor", input())).rejects.toThrow();
    expect(await db.workOrder.count()).toBe(before);
    expect(await db.orderCounter.findUniqueOrThrow({ where: { studioId: studios[0]! } })).toEqual(counter);
  });

  it("reads by id and number and isolates records and related inputs across tenants", async () => {
    const a = studios[0]!, b = studios[1]!, order = await newOrder();
    for (const key of [order.id, order.number]) {
      expect(await (await get(request(), context(a, key))).json()).toMatchObject({ id: order.id });
    }
    const rows = await (await list(request(), context(b))).json();
    expect(rows.every((row: { studioId: string }) => row.studioId === b)).toBe(true);
    for (const id of [order.id, "missing"]) {
      expect((await get(request(), context(b, id))).status).toBe(404);
      expect((await status(request("POST", { status: "in_progress" }), context(b, id))).status).toBe(404);
      expect((await advance(request("POST"), context(b, id))).status).toBe(404);
    }
    for (const data of [{ ...input(), clientId: clients[1] }, { ...input(), vehicleId: vehicles[1] }]) {
      expect((await create(request("POST", data), context(a))).status).toBe(404);
    }
    expect((await get(request(), context(b, order.number))).status).toBe(404);
    const otherClient = await studioDb(a).client.create({ data: { studioId: a, name: "Other" } });
    expect((await create(request("POST", { ...input(), clientId: otherClient.id }), context(a))).status).toBe(400);
    expect(await studioDb(a).workOrder.findFirstOrThrow({ where: { id: order.id } })).toMatchObject({ status: "accepted", stage: 1 });
  });

  it("uses the state machine, returns 409 for illegal moves, and records the actor", async () => {
    const order = await newOrder(), ctx = context(studios[0]!, order.id);
    for (const target of ["completed", "ready_for_pickup"]) expect((await status(request("POST", { status: target }), ctx)).status).toBe(409);
    expect((await advance(request("POST"), ctx)).status).toBe(409);
    expect((await status(request("POST", { status: "unknown" }), ctx)).status).toBe(400);
    expect((await status(request("POST", { status: "in_progress" }), ctx)).status).toBe(200);
    for (const [expectedStatus, stage] of [["in_progress", 2], ["in_progress", 3], ["ready_for_pickup", 4]]) {
      const response = await advance(request("POST"), ctx);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: expectedStatus, stage });
    }
    const done = await status(request("POST", { status: "completed" }), ctx);
    expect(done.status).toBe(200);
    expect((await done.json()).completedAt).toBeTruthy();
    expect((await advance(request("POST"), ctx)).status).toBe(409);
    expect((await status(request("POST", { status: "in_progress" }), ctx)).status).toBe(409);
    const history = await studioDb(studios[0]!).workOrderEvent.findMany({ where: { workOrderId: order.id } });
    expect(history).toHaveLength(6);
    expect(history.every((event) => event.actorId === userId)).toBe(true);
  });

  it("allows exactly one competing status change through HTTP", async () => {
    const order = await newOrder(), ctx = context(studios[0]!, order.id);
    const responses = await Promise.all(["in_progress", "canceled"].map((target) => status(request("POST", { status: target }), ctx)));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await studioDb(studios[0]!).workOrderEvent.count({ where: { workOrderId: order.id } })).toBe(2);
  });

  it("validates Decimal strings, Warsaw/DST dates and forbidden fields before writes", async () => {
    const ctx = context(studios[0]!);
    for (const patch of [
      { totalGross: 1234.56 }, { totalGross: "1.001" }, { totalGross: "-1" }, { totalGross: "10000000000" }, { totalGross: "NaN" },
      { scheduledFrom: "2026-03-29T02:30" }, { scheduledFrom: "2026-10-25T02:30" },
      { scheduledFrom: "2026-02-30T10:00" }, { scheduledTo: input().scheduledFrom },
      { service: " " }, { status: "completed" }, { stage: 3 }, { studioId: studios[1] },
    ]) expect((await create(request("POST", { ...input(), ...patch }), ctx)).status).toBe(400);
    for (const [from, to, utc] of [
      ["2026-07-01T10:00", "2026-07-01T12:00", "2026-07-01T08:00:00.000Z"],
      ["2026-10-25T02:30:00+02:00", "2026-10-25T02:30:00+01:00", "2026-10-25T00:30:00.000Z"],
    ]) {
      const response = await create(request("POST", { ...input(), scheduledFrom: from, scheduledTo: to }), ctx);
      expect(response.status).toBe(201);
      expect((await response.json()).scheduledFrom).toBe(utc);
    }
    const malformed = new Request("http://localhost:3000", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "{" });
    expect((await create(malformed, ctx)).status).toBe(400);
  });

  it("requires auth and membership, checks Origin on every write, and permits all three roles", async () => {
    const order = await newOrder(), ctx = context(studios[0]!, order.id);
    const calls = [() => list(request(), ctx), () => get(request(), ctx), () => create(request("POST", input()), ctx), () => status(request("POST", { status: "in_progress" }), ctx), () => advance(request("POST"), ctx)];
    mocks.session.mockResolvedValue(null);
    for (const call of calls) expect((await call()).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: "outsider" } });
    for (const call of calls) expect((await call()).status).toBe(404);
    mocks.session.mockResolvedValue({ user: { id: userId } });
    expect((await list(request(), context("missing-studio"))).status).toBe(404);
    for (const origin of [null, "https://evil.example"]) {
      expect((await create(request("POST", input(), origin), ctx)).status).toBe(403);
      expect((await status(request("POST", { status: "in_progress" }, origin), ctx)).status).toBe(403);
      expect((await advance(request("POST", undefined, origin), ctx)).status).toBe(403);
    }
    for (const role of ["owner", "manager", "worker"] as const) {
      await studioDb(studios[0]!).membership.updateMany({ where: { userId }, data: { role } });
      const own = await newOrder();
      const ownCtx = context(studios[0]!, own.id);
      expect((await list(request(), ownCtx)).status).toBe(200);
      expect((await get(request(), ownCtx)).status).toBe(200);
      expect((await status(request("POST", { status: "in_progress" }), ownCtx)).status).toBe(200);
      expect((await advance(request("POST"), ownCtx)).status).toBe(200);
    }
  });

  it("keeps reads available but forbids all writes under each billing restriction", async () => {
    const a = studios[0]!, order = await newOrder(), ctx = context(a, order.id);
    for (const state of ["past_due", "suspended", "canceled", "trial"] as const) {
      await platformDb.studio.update({ where: { id: a }, data: { status: state, trialEndsAt: new Date(0) } });
      expect((await list(request(), ctx)).status).toBe(200);
      expect((await get(request(), ctx)).status).toBe(200);
      expect((await create(request("POST", input()), ctx)).status).toBe(403);
      expect((await status(request("POST", { status: "in_progress" }), ctx)).status).toBe(403);
      expect((await advance(request("POST"), ctx)).status).toBe(403);
    }
    await platformDb.studio.update({ where: { id: a }, data: { status: "active" } });
  });
});
