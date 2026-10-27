import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { hashPortalToken } from "@/lib/portal/token";
import { saveQuote, sendQuote } from "./send";
import { deliverQuoteMails } from "./mail";
import { PUT, GET } from "@/app/api/studios/[studioId]/quotes/[quoteId]/route";
import { POST } from "@/app/api/studios/[studioId]/quotes/[quoteId]/send/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.SMTP_URL = "smtp://localhost:1025";
  return { send: vi.fn(), session: vi.fn() };
});
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail: mocks.send }) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID();
const studios: string[] = [];
let userId: string;
let workerId: string;
async function fixture(index = 0, email: string | null = "client@example.test") {
  const studioId = studios[index]!;
  const db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: "Adam Nowak", email } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Porsche", model: "Panamera", plate: "WA TEST" } });
  const input = { clientId: client.id, vehicleId: vehicle.id, size: "medium", paintMult: "1.00", notes: "Uwagi klienta",
    items: [{ name: "Korekta lakieru", basePrice: "2000.00", durationMin: 400 }, { name: "Powłoka ceramiczna", basePrice: "2000.00", durationMin: 200 }] };
  const id = randomUUID();
  return { db, studioId, input, id };
}
beforeAll(async () => {
  for (const suffix of ["a", "b"]) studios.push((await platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: `Studio ${suffix}` } })).id);
  userId = (await platformDb.user.create({ data: { email: `${tag}@example.test`, name: "Owner" } })).id;
  workerId = (await platformDb.user.create({ data: { email: `${tag}-worker@example.test`, name: "Worker" } })).id;
  for (const [id, role] of [[userId, "owner"], [workerId, "worker"]] as const) {
    await studioDb(studios[0]!).membership.create({ data: { studioId: studios[0]!, userId: id, role } });
  }
});
beforeEach(() => { mocks.send.mockReset().mockResolvedValue({}); mocks.session.mockResolvedValue({ user: { id: userId } }); });
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { id: { in: [userId, workerId] } } });
});

describe("quote persistence and e-mail jobs (Postgres)", () => {
  it("saves Decimal totals and replaces item snapshots on repeated PUT", async () => {
    const f = await fixture();
    const first = await saveQuote(f.studioId, f.id, f.input);
    expect(first.status).toBe("draft");
    expect(first.totalGross.toFixed(2)).toBe("4800.00");
    expect(first.vatAmount.toFixed(2)).toBe("897.56");
    const updated = await saveQuote(f.studioId, f.id, { ...f.input, items: [{ name: "Edycja usługi", basePrice: "100.01", durationMin: null }] });
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.name).toBe("Edycja usługi");
    expect(updated.totalGross.toFixed(2)).toBe("120.01");
  });

  it("queues, sends and resends without duplicating items; stores only portal hashes", async () => {
    const f = await fixture();
    await saveQuote(f.studioId, f.id, f.input);
    await Promise.all([sendQuote(f.studioId, f.id), sendQuote(f.studioId, f.id)]);
    expect(await f.db.quoteSendMail.count({ where: { quoteId: f.id, sentAt: null } })).toBe(1);
    await Promise.all([deliverQuoteMails(), deliverQuoteMails()]);
    const messages = mocks.send.mock.calls.map(([mail]) => mail).filter((mail) => mail.to === "client@example.test" && mail.text.includes(f.input.notes));
    expect(messages).toHaveLength(1);
    const url = messages[0].text.match(/http:\/\/localhost:3000\/p\/([\w-]+)/)!;
    const links = await f.db.portalLink.findMany({ where: { quoteId: f.id } });
    expect(links).toHaveLength(1);
    expect(links[0]!.tokenHash).toBe(hashPortalToken(url[1]!));
    expect(JSON.stringify(await f.db.quoteSendMail.findMany())).not.toContain(url[1]);
    expect((await f.db.quote.findFirstOrThrow({ where: { id: f.id } })).sentAt).toBeTruthy();
    mocks.send.mockClear();
    await sendQuote(f.studioId, f.id);
    await deliverQuoteMails();
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(await f.db.quoteItem.count({ where: { quoteId: f.id } })).toBe(2);
    await expect(saveQuote(f.studioId, f.id, f.input)).rejects.toThrow("nie można edytować");
  });

  it("rolls back failed SMTP and retries the pending job without retaining a dead link", async () => {
    const f = await fixture();
    await saveQuote(f.studioId, f.id, f.input);
    await sendQuote(f.studioId, f.id);
    mocks.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await deliverQuoteMails();
    expect(await f.db.quoteSendMail.count({ where: { quoteId: f.id, sentAt: null } })).toBe(1);
    expect(await f.db.portalLink.count({ where: { quoteId: f.id } })).toBe(0);
    expect((await f.db.quote.findFirstOrThrow({ where: { id: f.id } })).sentAt).toBeNull();
    await deliverQuoteMails();
    expect(await f.db.quoteSendMail.count({ where: { quoteId: f.id, sentAt: null } })).toBe(0);
  });

  it("does not send or reset a quote already decided in the portal", async () => {
    const f = await fixture();
    await saveQuote(f.studioId, f.id, f.input);
    await sendQuote(f.studioId, f.id);
    await f.db.quote.updateMany({ where: { id: f.id }, data: { status: "accepted", decidedAt: new Date() } });
    await deliverQuoteMails();
    expect(mocks.send).not.toHaveBeenCalled();
    expect((await f.db.quote.findFirstOrThrow({ where: { id: f.id } })).status).toBe("accepted");
    await expect(sendQuote(f.studioId, f.id)).rejects.toThrow();
  });

  it("rejects missing e-mail and invalid money without changing the draft", async () => {
    const f = await fixture(0, null);
    await saveQuote(f.studioId, f.id, f.input);
    await expect(sendQuote(f.studioId, f.id)).rejects.toThrow("e-mail");
    expect((await f.db.quote.findFirstOrThrow({ where: { id: f.id } })).status).toBe("draft");
    for (const basePrice of [1.23, "-1", "NaN", "1.001"]) {
      await expect(saveQuote(f.studioId, f.id, { ...f.input, items: [{ ...f.input.items[0], basePrice }] })).rejects.toThrow();
    }
  });

  it("isolates clients, vehicles, quotes, items and jobs between studios", async () => {
    const a = await fixture(); const b = await fixture(1);
    await saveQuote(a.studioId, a.id, a.input);
    await expect(saveQuote(b.studioId, b.id, a.input)).rejects.toThrow();
    await expect(saveQuote(a.studioId, randomUUID(), { ...a.input, vehicleId: b.input.vehicleId })).rejects.toThrow();
    await expect(saveQuote(a.studioId, randomUUID(), { ...a.input, clientId: (await fixture()).input.clientId })).rejects.toThrow();
    await expect(sendQuote(b.studioId, a.id)).rejects.toThrow();
    expect(await b.db.quote.findFirst({ where: { id: a.id } })).toBeNull();
    expect(await b.db.quoteItem.count({ where: { quoteId: a.id } })).toBe(0);
    expect(await b.db.quoteSendMail.count({ where: { quoteId: a.id } })).toBe(0);
  });

  it("enforces session, membership, role and origin in HTTP handlers", async () => {
    const f = await fixture();
    const context = { params: Promise.resolve({ studioId: f.studioId, quoteId: f.id }) };
    const request = (origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/studios/${f.studioId}/quotes/${f.id}`, { method: "PUT", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(f.input) });
    mocks.session.mockResolvedValueOnce(null);
    expect((await PUT(request(), context)).status).toBe(401);
    mocks.session.mockResolvedValueOnce({ user: { id: workerId } });
    expect((await PUT(request(), context)).status).toBe(403);
    expect((await PUT(request("http://evil.test"), context)).status).toBe(403);
    expect((await PUT(request(), context)).status).toBe(200);
    expect((await GET(request(), { params: Promise.resolve({ studioId: studios[1]!, quoteId: f.id }) })).status).toBe(403);
    expect((await POST(request(), context)).status).toBe(202);
    await deliverQuoteMails();
  });
});
