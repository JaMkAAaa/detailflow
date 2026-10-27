import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { generatePortalToken, hashPortalToken } from "@/lib/portal/token";
import { createPortalLink, decideQuote, readPortal, resolvePortalLink, revokePortalLink, PORTAL_TTL_MS } from "./links";
import { deliverQuoteDecisionMails } from "./mail";
import PortalPage from "@/app/p/[token]/page";
import { POST as postDecision } from "@/app/p/[token]/decision/route";
import { POST as postLink } from "@/app/api/studios/[studioId]/portal-links/route";
import { DELETE as deleteLink } from "@/app/api/studios/[studioId]/portal-links/[linkId]/route";

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
let seq = 0;
const tokenFrom = (link: { path: string }) => link.path.slice(3);
async function fixture(index = 0, status: "sent" | "draft" | "expired" = "sent") {
  const studioId = studios[index]!;
  const db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: `Klient ${++seq}` } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Porsche", model: "911", plate: "WA TEST" } });
  const quote = await db.quote.create({ data: { studioId, clientId: client.id, vehicleId: vehicle.id, status,
    sizeMult: "1.20", paintMult: "1.00", totalGross: "4800.00", vatAmount: "897.56" } });
  const link = await createPortalLink(db, studioId, { quoteId: quote.id });
  return { db, studioId, quote, link, token: tokenFrom(link) };
}
const page = (token: string) => PortalPage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({}) });
const decisionRequest = (token: string, decision = "accepted", origin = "http://localhost:3000") =>
  postDecision(new Request(`http://localhost:3000/p/${token}/decision`, {
    method: "POST", headers: { origin }, body: new URLSearchParams({ decision }),
  }), { params: Promise.resolve({ token }) });

beforeAll(async () => {
  for (const suffix of ["a", "b"]) studios.push((await platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: `Studio ${suffix}` } })).id);
  userId = (await platformDb.user.create({ data: { email: `${tag}@example.test`, name: "Owner" } })).id;
  await studioDb(studios[0]!).membership.create({ data: { studioId: studios[0]!, userId, role: "owner" } });
});
beforeEach(() => { mocks.send.mockReset().mockResolvedValue({}); mocks.session.mockResolvedValue({ user: { id: userId } }); });
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { id: userId } });
});

describe("portal tokens and decisions (Postgres)", () => {
  it("stores only SHA-256 and issues a 256-bit URL with 14-day TTL", async () => {
    const start = Date.now();
    const { db, link, token } = await fixture();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const row = await db.portalLink.findFirstOrThrow({ where: { id: link.id } });
    expect(row.tokenHash).toBe(hashPortalToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.expiresAt.getTime()).toBeGreaterThanOrEqual(start + PORTAL_TTL_MS);
    expect((await readPortal(token))?.quote?.totalGross.toFixed(2)).toBe("4800.00");
  });

  it.each(["invalid", "", "obsidian-df-0248-demo-extra", "obsidian-df-0244-expired", "x".repeat(129), generatePortalToken()])("unknown token renders P-02 without throwing: %s", async (token) => {
    expect(await resolvePortalLink(token)).toBeNull();
    expect(renderToStaticMarkup(await page(token))).toContain("Ten link już wygasł");
  });

  it("keeps the seeded P-01 demo behind database token validation", async () => {
    const html = renderToStaticMarkup(await page("obsidian-df-0248-demo"));
    expect(html).toContain("Cześć, ");
    expect(html).toContain("Etapy zlecenia");
    expect(html).toContain("Ceramika i kontrola");
  });

  it("does not bypass token validation for the static P-01 demo", async () => {
    const token = "obsidian-df-0248-demo";
    const link = await platformDb.portalLink.findUniqueOrThrow({ where: { tokenHash: hashPortalToken(token) } });
    const db = studioDb(link.studioId);
    try {
      await db.portalLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
      const html = renderToStaticMarkup(await page(token));
      expect(html).toContain("Ten link już wygasł");
      expect(html).not.toContain("Porsche");
    } finally {
      await db.portalLink.update({ where: { id: link.id }, data: { revokedAt: link.revokedAt } });
    }
  });

  it("expires and revokes links and forbids decisions through them", async () => {
    const f = await fixture();
    await f.db.portalLink.update({ where: { id: f.link.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(renderToStaticMarkup(await page(f.token))).toContain("Ten link już wygasł");
    await expect(decideQuote(f.token, "accepted")).rejects.toThrow();
    const other = await createPortalLink(f.db, f.studioId, { quoteId: f.quote.id });
    await revokePortalLink(f.db, other.id);
    expect(await readPortal(tokenFrom(other))).toBeNull();
    await expect(decideQuote(tokenFrom(other), "rejected")).rejects.toThrow();
    expect(await f.db.quote.findFirstOrThrow({ where: { id: f.quote.id } })).toMatchObject({ status: "sent", decidedAt: null });
  });

  it.each(["accepted", "rejected"] as const)("records %s once, confirms it, and queues one token-free notification", async (decision) => {
    const f = await fixture();
    expect(renderToStaticMarkup(await page(f.token))).toContain("Akceptuję wycenę");
    expect((await decisionRequest(f.token, decision)).status).toBe(303);
    expect(await f.db.quote.findFirstOrThrow({ where: { id: f.quote.id } })).toMatchObject({ status: decision, decidedAt: expect.any(Date) });
    const html = renderToStaticMarkup(await page(f.token));
    expect(html).toContain("Decyzja została zapisana");
    expect(html).not.toContain("<form");
    await expect(decideQuote(f.token, "accepted")).rejects.toThrow();
    const notifications = await f.db.quoteDecisionMail.findMany({ where: { quoteId: f.quote.id } });
    expect(notifications).toHaveLength(1);
    expect(JSON.stringify(notifications)).not.toContain(f.token);
  });

  it("serializes concurrent opposite decisions through different links", async () => {
    const f = await fixture();
    const other = await createPortalLink(f.db, f.studioId, { quoteId: f.quote.id });
    const results = await Promise.allSettled([decideQuote(f.token, "accepted"), decideQuote(tokenFrom(other), "rejected")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await f.db.quoteDecisionMail.count({ where: { quoteId: f.quote.id } })).toBe(1);
  });

  it("supports existing order links and enforces tenant and target constraints in SQL", async () => {
    const a = await fixture();
    const b = await fixture(1);
    const order = await a.db.workOrder.create({ data: {
      studioId: a.studioId, number: `DF-${++seq}`, clientId: a.quote.clientId, vehicleId: a.quote.vehicleId,
      quoteId: a.quote.id, status: "accepted", service: "Korekta", totalGross: "4800.00",
      scheduledFrom: new Date(), scheduledTo: new Date(),
    } });
    const link = await createPortalLink(a.db, a.studioId, { workOrderId: order.id });
    expect((await readPortal(tokenFrom(link)))?.order?.number).toBe(order.number);
    await decideQuote(tokenFrom(link), "accepted");
    expect((await readPortal(a.token))?.quote?.status).toBe("accepted");
    const data = { studioId: a.studioId, expiresAt: new Date(Date.now() + PORTAL_TTL_MS) };
    await expect(a.db.portalLink.create({ data: { ...data, quoteId: b.quote.id, tokenHash: hashPortalToken(generatePortalToken()) } })).rejects.toThrow();
    await expect(a.db.portalLink.create({ data: { ...data, tokenHash: hashPortalToken(generatePortalToken()) } })).rejects.toThrow();
    await expect(a.db.portalLink.create({ data: { ...data, quoteId: a.quote.id, workOrderId: order.id, tokenHash: hashPortalToken(generatePortalToken()) } })).rejects.toThrow();
  });

  it.each(["draft", "expired"] as const)("refuses a %s quote", async (status) => {
    const f = await fixture(0, status);
    await expect(decideQuote(f.token, "accepted")).rejects.toThrow();
    expect(await f.db.quoteDecisionMail.count({ where: { quoteId: f.quote.id } })).toBe(0);
  });

  it("rejects forged decisions and cross-origin POSTs", async () => {
    const f = await fixture();
    expect((await decisionRequest(f.token, "accepted", "https://evil.test")).status).toBe(403);
    expect((await decisionRequest(f.token, "draft")).headers.get("location")).toContain("unavailable=1");
    expect(await f.db.quote.findFirstOrThrow({ where: { id: f.quote.id } })).toMatchObject({ status: "sent" });
  });

  it("scopes link creation/revocation and decision to the target studio", async () => {
    const a = await fixture();
    const b = await fixture(1);
    await expect(createPortalLink(a.db, a.studioId, { quoteId: b.quote.id })).rejects.toThrow();
    expect((await revokePortalLink(a.db, b.link.id)).count).toBe(0);
    await decideQuote(b.token, "rejected");
    expect(await a.db.quote.findFirstOrThrow({ where: { id: a.quote.id } })).toMatchObject({ status: "sent" });
    expect(await a.db.quoteDecisionMail.count({ where: { quoteId: b.quote.id } })).toBe(0);
    const req = (quoteId: string) => new Request("http://localhost:3000/api/studios/portal-links", {
      method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ quoteId }),
    });
    expect((await postLink(req(b.quote.id), { params: Promise.resolve({ studioId: a.studioId }) })).status).toBe(404);
    expect((await postLink(req(b.quote.id), { params: Promise.resolve({ studioId: b.studioId }) })).status).toBe(403);
    expect((await deleteLink(new Request("http://localhost:3000/api", { method: "DELETE", headers: { origin: "http://localhost:3000" } }), {
      params: Promise.resolve({ studioId: a.studioId, linkId: b.link.id }),
    })).status).toBe(204);
    expect(await resolvePortalLink(b.token)).not.toBeNull();
    mocks.session.mockResolvedValue(null);
    expect((await postLink(req(a.quote.id), { params: Promise.resolve({ studioId: a.studioId }) })).status).toBe(401);
  });

  it("keeps failed mail pending for retry, then sends to the studio owner without a token", async () => {
    // Rozlicz wcześniejsze wpisy przed kontrolowanym scenariuszem awarii.
    await deliverQuoteDecisionMails();
    mocks.send.mockClear();
    const f = await fixture();
    await decideQuote(f.token, "accepted");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    await deliverQuoteDecisionMails();
    expect(await f.db.quoteDecisionMail.findFirstOrThrow({ where: { quoteId: f.quote.id } })).toMatchObject({ sentAt: null });
    await deliverQuoteDecisionMails();
    expect(await f.db.quoteDecisionMail.findFirstOrThrow({ where: { quoteId: f.quote.id } })).toMatchObject({ sentAt: expect.any(Date) });
    expect(mocks.send.mock.lastCall?.[0]).toMatchObject({ to: [`${tag}@example.test`], text: expect.stringContaining("4800.00 PLN") });
    expect(JSON.stringify(mocks.send.mock.calls)).not.toContain(f.token);
    expect(JSON.stringify(log.mock.calls)).not.toContain(f.token);
    const count = mocks.send.mock.calls.length;
    await deliverQuoteDecisionMails();
    expect(mocks.send).toHaveBeenCalledTimes(count);
    log.mockRestore();
  });
});
