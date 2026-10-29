import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb, type StudioDb } from "../../../lib/db/tenant";
import type { OrderStatus } from "../../../lib/db/generated/client";
import {
  ORDER_TRANSITIONS,
  OrderStateError,
  STAGE_RANGE,
  advanceStage,
  allocateOrderNumber,
  allowedTransitions,
  assertInvoiceable,
  canInvoice,
  canTransition,
  isActiveStatus,
  isValidStage,
  listOrderHistory,
  transitionOrder,
} from "./state";

const STATUSES: OrderStatus[] = ["accepted", "in_progress", "ready_for_pickup", "completed", "canceled"];

describe("transition map", () => {
  it("lists every status and only legal targets", () => {
    expect(Object.keys(ORDER_TRANSITIONS).sort()).toEqual([...STATUSES].sort());
    expect(allowedTransitions("accepted")).toEqual(["in_progress", "canceled"]);
  });

  it("cannot finish an accepted order without it being in progress", () => {
    expect(canTransition("accepted", "completed")).toBe(false);
    expect(canTransition("accepted", "ready_for_pickup")).toBe(false);
    expect(canTransition("accepted", "in_progress")).toBe(true);
  });

  it("completed and canceled are terminal, nothing goes back to accepted", () => {
    for (const from of STATUSES) {
      expect(canTransition(from, "accepted")).toBe(false);
      expect(canTransition(from, from)).toBe(false);
    }
    expect(allowedTransitions("completed")).toEqual([]);
    expect(allowedTransitions("canceled")).toEqual([]);
  });

  it("keeps stage within the range of the status", () => {
    expect(isValidStage("accepted", 1)).toBe(true);
    expect(isValidStage("accepted", 2)).toBe(false);
    expect(isValidStage("in_progress", 3)).toBe(true);
    expect(isValidStage("in_progress", 4)).toBe(false);
    expect(isValidStage("ready_for_pickup", 4)).toBe(true);
    expect(isValidStage("completed", 3)).toBe(false);
    expect(isValidStage("in_progress", 2.5)).toBe(false);
    expect(Object.keys(STAGE_RANGE)).toHaveLength(STATUSES.length);
  });

  it("only a completed order with completedAt can be invoiced", () => {
    const done = new Date();
    for (const status of STATUSES) {
      expect(canInvoice({ status, completedAt: done })).toBe(status === "completed");
    }
    expect(canInvoice({ status: "completed", completedAt: null })).toBe(false);
    expect(STATUSES.filter(isActiveStatus)).toEqual(["accepted", "in_progress", "ready_for_pickup"]);
  });
});

describe("work order state (Postgres)", () => {
  const tag = randomUUID();
  let a: string;
  let b: string;
  let da: StudioDb;
  let db: StudioDb;
  let userId: string;
  let clientId: string;
  let vehicleId: string;
  let seq = 0;

  const makeOrder = async (status: OrderStatus = "accepted", stage = 1, studio: StudioDb = da, studioId = a) => {
    const n = ++seq;
    return studio.workOrder.create({
      data: {
        studioId,
        number: `DF-${String(9000 + n)}`,
        clientId: studio === da ? clientId : (await studio.client.findFirstOrThrow()).id,
        vehicleId: studio === da ? vehicleId : (await studio.vehicle.findFirstOrThrow()).id,
        status,
        stage,
        service: "Korekta",
        scheduledFrom: new Date("2026-10-24T08:00:00Z"),
        scheduledTo: new Date("2026-10-24T12:00:00Z"),
        totalGross: "100.00",
        ...(status === "completed" ? { completedAt: new Date() } : {}),
      },
    });
  };

  beforeAll(async () => {
    const studios = await Promise.all(
      ["a", "b"].map((s) =>
        platformDb.studio.create({ data: { publicCode: `${tag}-${s}`, slug: `${tag}-${s}`, name: `State ${s}`, ksefEnv: "test" } }),
      ),
    );
    [a, b] = studios.map((s) => s.id) as [string, string];
    da = studioDb(a);
    db = studioDb(b);
    userId = (await platformDb.user.create({ data: { email: `${tag}@example.test`, name: "Tester" } })).id;
    for (const [studio, id] of [[da, a], [db, b]] as const) {
      const client = await studio.client.create({ data: { studioId: id, name: "Klient" } });
      const vehicle = await studio.vehicle.create({ data: { studioId: id, clientId: client.id, make: "Porsche", model: "911", plate: `WA ${id.slice(-4)}` } });
      if (id === a) [clientId, vehicleId] = [client.id, vehicle.id];
    }
  });

  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { slug: { startsWith: tag } } });
    await platformDb.user.deleteMany({ where: { email: `${tag}@example.test` } });
  });

  it("walks accepted → in progress → stages → ready → completed and records history", async () => {
    const order = await makeOrder();
    const started = await transitionOrder(da, { orderId: order.id, to: "in_progress", actorId: userId });
    expect([started.status, started.stage]).toEqual(["in_progress", 1]);

    const s2 = await advanceStage(da, { orderId: order.id, actorId: userId });
    expect([s2.status, s2.stage]).toEqual(["in_progress", 2]);
    const s3 = await advanceStage(da, { orderId: order.id });
    expect([s3.status, s3.stage]).toEqual(["in_progress", 3]);
    const ready = await advanceStage(da, { orderId: order.id });
    expect([ready.status, ready.stage]).toEqual(["ready_for_pickup", 4]);

    const now = new Date("2026-10-25T10:00:00Z");
    const done = await transitionOrder(da, { orderId: order.id, to: "completed", actorId: userId, now });
    expect([done.status, done.stage, done.completedAt]).toEqual(["completed", 4, now]);

    const history = await listOrderHistory(da, order.id);
    expect(history.map((e) => [e.fromStatus, e.toStatus, e.fromStage, e.toStage]).reverse()).toEqual([
      ["accepted", "in_progress", 1, 1],
      ["in_progress", "in_progress", 1, 2],
      ["in_progress", "in_progress", 2, 3],
      ["in_progress", "ready_for_pickup", 3, 4],
      ["ready_for_pickup", "completed", 4, 4],
    ]);
    // Najnowszy wpis ma aktora; „etap 3 → do odbioru” zapisano bez aktora.
    expect(history[0]!.actor).toEqual({ name: "Tester" });
    expect(history[1]!.actor).toBeNull();
  });

  it("rejects illegal jumps without writing anything", async () => {
    const order = await makeOrder();
    for (const to of ["completed", "ready_for_pickup"] as const) {
      await expect(transitionOrder(da, { orderId: order.id, to })).rejects.toMatchObject({ code: "invalid_transition" });
    }
    await expect(advanceStage(da, { orderId: order.id })).rejects.toMatchObject({ code: "invalid_stage" });
    expect(await da.workOrder.findFirstOrThrow({ where: { id: order.id } })).toMatchObject({ status: "accepted", stage: 1 });
    expect(await listOrderHistory(da, order.id)).toHaveLength(0);
  });

  it("dropping a card in the same column is a no-op", async () => {
    const order = await makeOrder("in_progress", 2);
    const same = await transitionOrder(da, { orderId: order.id, to: "in_progress" });
    expect(same.stage).toBe(2);
    expect(await listOrderHistory(da, order.id)).toHaveLength(0);
  });

  it("sending back from pickup returns to the last work stage; canceled is final", async () => {
    const order = await makeOrder("ready_for_pickup", 4);
    const back = await transitionOrder(da, { orderId: order.id, to: "in_progress" });
    expect([back.status, back.stage]).toEqual(["in_progress", 3]);

    const canceled = await transitionOrder(da, { orderId: order.id, to: "canceled" });
    expect([canceled.status, canceled.stage, canceled.completedAt]).toEqual(["canceled", 3, null]);
    await expect(transitionOrder(da, { orderId: order.id, to: "in_progress" })).rejects.toBeInstanceOf(OrderStateError);
  });

  it("only one of two mutually exclusive concurrent moves wins", async () => {
    const order = await makeOrder("in_progress", 1);
    // Neither target can follow the other if the database schedules reads sequentially.
    const results = await Promise.allSettled([
      transitionOrder(da, { orderId: order.id, to: "ready_for_pickup" }),
      transitionOrder(da, { orderId: order.id, to: "canceled" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listOrderHistory(da, order.id)).toHaveLength(1);
  });

  it("is invisible across studios", async () => {
    const mine = await makeOrder();
    const theirs = await makeOrder("accepted", 1, db, b);
    await expect(transitionOrder(db, { orderId: mine.id, to: "in_progress" })).rejects.toMatchObject({ code: "not_found" });
    await expect(advanceStage(db, { orderId: mine.id })).rejects.toMatchObject({ code: "not_found" });
    await expect(assertInvoiceable(db, mine.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await listOrderHistory(db, mine.id)).toEqual([]);
    expect((await da.workOrder.findFirstOrThrow({ where: { id: mine.id } })).status).toBe("accepted");

    await transitionOrder(db, { orderId: theirs.id, to: "in_progress" });
    expect(await listOrderHistory(da, theirs.id)).toEqual([]);
  });

  it("allows invoicing only after completion", async () => {
    const order = await makeOrder("in_progress", 2);
    await expect(assertInvoiceable(da, order.id)).rejects.toMatchObject({ code: "not_invoiceable" });
    await transitionOrder(da, { orderId: order.id, to: "ready_for_pickup" });
    await expect(assertInvoiceable(da, order.id)).rejects.toMatchObject({ code: "not_invoiceable" });
    await transitionOrder(da, { orderId: order.id, to: "completed" });
    await expect(assertInvoiceable(da, order.id)).resolves.toBeUndefined();
  });

  it("allocates unique DF-#### numbers per studio, continuing after existing ones", async () => {
    // Studio A ma już zlecenia DF-9001…, ale brak licznika: start od najwyższego.
    const highest = Math.max(...(await da.workOrder.findMany({ select: { number: true } })).map((o) => Number(o.number.slice(3))));
    const numbers = await Promise.all(Array.from({ length: 12 }, () => da.$transaction((tx) => allocateOrderNumber(tx, a))));
    expect(new Set(numbers).size).toBe(12);
    expect([...numbers].sort()).toEqual(Array.from({ length: 12 }, (_, i) => `DF-${String(highest + i + 1).padStart(4, "0")}`));
    // Studio B liczy niezależnie.
    const [theirs] = await db.workOrder.findMany({ select: { number: true } });
    expect(await db.$transaction((tx) => allocateOrderNumber(tx, b))).toBe(`DF-${Number(theirs!.number.slice(3)) + 1}`);
  });
});
