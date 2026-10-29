import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { createPortalLink, decideQuote, PORTAL_TTL_MS } from "../portal/links";
import { expireQuotes } from "./expire";
import { POST } from "@/app/p/[token]/decision/route";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
});

const studios: string[] = [];
const now = new Date();
beforeAll(async () => {
  for (const suffix of ["a", "b"]) {
    const code = `${randomUUID()}-${suffix}`;
    studios.push((await platformDb.studio.create({ data: { publicCode: code, slug: code, name: code } })).id);
  }
  const rows = await platformDb.studio.findMany({ where: { id: { in: studios } } });
  vi.spyOn(platformDb.studio, "findMany").mockResolvedValue(rows);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
});
async function fixture(index = 0, age = 0) {
  const studioId = studios[index]!;
  const db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: "Expiry test" } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Test", model: "Test", plate: "TEST" } });
  const quote = await db.quote.create({ data: { studioId, clientId: client.id, vehicleId: vehicle.id,
    status: "sent", sentAt: new Date(now.getTime() - age), sizeMult: "1", paintMult: "1", totalGross: "100", vatAmount: "18.70" } });
  const link = await createPortalLink(db, studioId, { quoteId: quote.id });
  return { db, studioId, quote, link, token: link.path.slice(3),
    read: () => db.quote.findFirstOrThrow({ where: { id: quote.id } }) };
}

describe("quote expiration (Postgres)", () => {
  it("expires at 14 days despite a newer link and isolates tenants", async () => {
    const a = await fixture(0, PORTAL_TTL_MS);
    const b = await fixture(1, PORTAL_TTL_MS - 1);
    await expireQuotes(now);
    expect((await a.read()).status).toBe("expired");
    expect((await b.read()).status).toBe("sent");
    expect(await b.db.quote.findFirst({ where: { id: a.quote.id } })).toBeNull();
    await expect(decideQuote(a.token, "accepted")).rejects.toThrow();
    const response = await POST(new Request(`http://localhost:3000/p/${a.token}/decision`, {
      method: "POST", headers: { origin: new URL(process.env.APP_URL!).origin },
      body: new URLSearchParams({ decision: "accepted" }),
    }), { params: Promise.resolve({ token: a.token }) });
    expect(response.headers.get("location")).toContain("unavailable=1");
    expect(await a.db.quoteDecisionMail.count({ where: { quoteId: a.quote.id } })).toBe(0);
  });

  it("uses the last valid link, including links to the associated order", async () => {
    const f = await fixture();
    await f.db.portalLink.update({ where: { id: f.link.id }, data: { expiresAt: now } });
    const another = await createPortalLink(f.db, f.studioId, { quoteId: f.quote.id });
    await expireQuotes(now);
    expect((await f.read()).status).toBe("sent");
    await f.db.portalLink.update({ where: { id: another.id }, data: { revokedAt: now } });
    const order = await f.db.workOrder.create({ data: { studioId: f.studioId, clientId: f.quote.clientId,
      vehicleId: f.quote.vehicleId, quoteId: f.quote.id, number: "DF-EXPIRY", status: "accepted", service: "Test",
      scheduledFrom: now, scheduledTo: now, totalGross: "100" } });
    const orderLink = await createPortalLink(f.db, f.studioId, { workOrderId: order.id });
    await expireQuotes(now);
    expect((await f.read()).status).toBe("sent");
    await f.db.portalLink.update({ where: { id: orderLink.id }, data: { revokedAt: now } });
    await expireQuotes(now);
    expect((await f.read()).status).toBe("expired");
    await expireQuotes(now);
    expect((await f.read()).status).toBe("expired");
  });

  it("preserves drafts, decisions and mail jobs not yet delivered", async () => {
    for (const status of ["draft", "accepted", "rejected", "sent"] as const) {
      const f = await fixture(0, PORTAL_TTL_MS);
      await f.db.quote.updateMany({ where: { id: f.quote.id }, data: {
        status, sentAt: status === "sent" ? null : f.quote.sentAt,
        decidedAt: status === "accepted" || status === "rejected" ? now : null,
      } });
      await f.db.portalLink.deleteMany({ where: { quoteId: f.quote.id } });
      await expireQuotes(now);
      expect((await f.read()).status).toBe(status);
    }
    const inconsistent = await fixture(0, PORTAL_TTL_MS);
    await inconsistent.db.quote.updateMany({ where: { id: inconsistent.quote.id }, data: { decidedAt: now } });
    await expireQuotes(now);
    expect((await inconsistent.read()).status).toBe("sent");
  });

  it("rejects a decision after 14 days even before the worker tick", async () => {
    const f = await fixture(0, PORTAL_TTL_MS + 1000);
    await expect(decideQuote(f.token, "accepted")).rejects.toThrow();
    expect((await f.read()).decidedAt).toBeNull();
    await expireQuotes(now);
    expect((await f.read()).status).toBe("expired");
  });

  it("does not overwrite a concurrent decision and emits no decision mail for expiration", async () => {
    const f = await fixture();
    // Sweep sees this quote as 14 days old; the live decision can still win the row lock.
    await Promise.all([decideQuote(f.token, "accepted").catch(() => undefined), expireQuotes(new Date(now.getTime() + PORTAL_TTL_MS))]);
    const quote = await f.read();
    expect(["accepted", "expired"]).toContain(quote.status);
    expect(quote.decidedAt !== null).toBe(quote.status === "accepted");
    expect(await f.db.quoteDecisionMail.count({ where: { quoteId: f.quote.id } })).toBe(quote.status === "accepted" ? 1 : 0);
    await expireQuotes(new Date(now.getTime() + PORTAL_TTL_MS));
    expect((await f.read()).status).toBe(quote.status);
  });
});
