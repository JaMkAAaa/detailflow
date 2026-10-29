import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { saveQuote } from "./send";
import { POST } from "@/app/api/studios/[studioId]/quotes/[quoteId]/order/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID(), studios: string[] = [];
let userId: string;
async function fixture(index = 0, status: "accepted" | "rejected" | "draft" | "sent" = "accepted") {
  const studioId = studios[index]!, db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: "Klient" } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Fiat", model: "Panda", plate: tag } });
  const quote = await saveQuote(studioId, randomUUID(), { clientId: client.id, vehicleId: vehicle.id, size: "medium", paintMult: "1.00", notes: "", slotId: "oct24",
    items: [{ name: "Korekta", basePrice: "100.01", durationMin: 60 }, { name: "Mycie", basePrice: "10.00", durationMin: 30 }] });
  await db.quote.update({ where: { id: quote.id }, data: { status } });
  return { studioId, db, quote, input: { clientId: client.id, vehicleId: vehicle.id, service: "Fałszywa usługa", totalGross: "0.01", scheduledFrom: "2026-11-02T10:00", scheduledTo: "2026-11-02T12:00" } };
}
function call(f: Awaited<ReturnType<typeof fixture>>, patch = {}, origin: string | null = "http://localhost:3000", studioId = f.studioId) {
  return POST(new Request("http://localhost:3000/api/quote/order", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify({ ...f.input, ...patch }) }), { params: Promise.resolve({ studioId, quoteId: f.quote.id }) });
}
beforeAll(async () => {
  userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.test` } })).id;
  mocks.session.mockResolvedValue({ user: { id: userId } });
  for (const suffix of ["a", "b"]) {
    const studioId = (await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, status: "active" } })).id;
    studios.push(studioId);
    await studioDb(studioId).membership.create({ data: { studioId, userId, role: "owner" } });
  }
});
afterAll(async () => {
  // Existing composite FK requires orders to be removed before their quotes.
  for (const id of studios) await studioDb(id).workOrder.deleteMany();
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  if (userId) await platformDb.user.delete({ where: { id: userId } });
});
describe("accepted quote → order (Postgres)", () => {
  it("uses the Decimal snapshot, ignores demo slot and returns one order under a race and retry", async () => {
    const f = await fixture(), foreign = await fixture(1);
    const spoofed = { clientId: foreign.input.clientId, vehicleId: foreign.input.vehicleId };
    const responses = await Promise.all([call(f, spoofed), call(f, spoofed)]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    const [a, b] = await Promise.all(responses.map((r) => r.json()));
    expect(a.id).toBe(b.id);
    expect(a).toMatchObject({ quoteId: f.quote.id, clientId: f.quote.clientId, vehicleId: f.quote.vehicleId,
      service: "Korekta, Mycie", totalGross: "132.01", bayId: null, status: "accepted", stage: 1,
      scheduledFrom: "2026-11-02T09:00:00.000Z", scheduledTo: "2026-11-02T11:00:00.000Z" });
    expect((await (await call(f)).json()).id).toBe(a.id);
    expect(await f.db.workOrder.count({ where: { quoteId: f.quote.id } })).toBe(1);
    expect(await f.db.workOrderEvent.count({ where: { workOrderId: a.id } })).toBe(1);
    const stored = await f.db.workOrder.findFirstOrThrow({ where: { id: a.id } });
    expect(stored.totalGross.eq(f.quote.totalGross)).toBe(true);
  });
  it("requires an accepted quote and scopes source quotes to the studio", async () => {
    for (const status of ["rejected", "draft", "sent"] as const) {
      const f = await fixture(0, status);
      expect((await call(f)).status).toBe(409);
      expect(await f.db.workOrder.count({ where: { quoteId: f.quote.id } })).toBe(0);
    }
    const b = await fixture(1);
    expect((await call(b, {}, undefined, studios[0]!)).status).toBe(404);
    expect(await studioDb(studios[0]!).workOrder.count({ where: { quoteId: b.quote.id } })).toBe(0);
  });
  it("books only the chosen bay, handles conflicts and retry of an already booked order", async () => {
    const f = await fixture(), other = await fixture();
    const bay = await f.db.bay.create({ data: { studioId: f.studioId, name: "Boks", sort: 0 } });
    const foreign = await studioDb(studios[1]!).bay.create({ data: { studioId: studios[1]!, name: "Obcy", sort: 0 } });
    expect((await call(f, { bayId: foreign.id })).status).toBe(404);
    const created = await call(f, { bayId: bay.id });
    expect(created.status).toBe(200);
    const order = await created.json();
    expect(order.bayId).toBe(bay.id);
    expect((await call(other, { bayId: bay.id })).status).toBe(409);
    expect((await (await call(f, { bayId: bay.id })).json()).id).toBe(order.id);
  });
  it("enforces owner/manager, auth, membership, Origin and billing restrictions", async () => {
    const f = await fixture();
    for (const role of ["owner", "manager", "worker"] as const) {
      await f.db.membership.updateMany({ where: { userId }, data: { role } });
      expect((await call(f)).status).toBe(role === "worker" ? 403 : 200);
    }
    await f.db.membership.updateMany({ where: { userId }, data: { role: "owner" } });
    for (const origin of [null, "https://evil.test"]) expect((await call(f, {}, origin)).status).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await call(f)).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: "outsider" } });
    expect((await call(f)).status).toBe(404);
    mocks.session.mockResolvedValue({ user: { id: userId } });
    await platformDb.studio.update({ where: { id: f.studioId }, data: { status: "past_due" } });
    expect((await call(f)).status).toBe(403);
    await platformDb.studio.update({ where: { id: f.studioId }, data: { status: "active" } });
  });
});
