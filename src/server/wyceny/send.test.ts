import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { authorizeStudio } from "../acl";
import { seedServices, updateService } from "./catalog";
import { saveQuote, sendQuote } from "./send";
import { deliverQuoteEmail } from "./email";
import { loadQuoteWizard } from "./query";
import { relayQuoteEmails } from "./outbox";

const tag = randomUUID();
const studios: string[] = [];
let owner: string;
let worker: string;
const fixtures: Array<{ clientId: string; vehicleId: string; items: Array<{ serviceId: string; name: string; basePrice: string; durationMin: number }> }> = [];
const input = (index = 0) => ({ id: randomUUID(), revision: 0, ...fixtures[index]!, size: "medium" as const, paint: "standard" as const, interior: "Umiarkowane" as const, step: 2, slotId: "oct24", notes: "Kontakt przed odbiorem." });

beforeAll(async () => {
  owner = (await platformDb.user.create({ data: { name: "Owner", email: `${tag}@example.com` } })).id;
  worker = (await platformDb.user.create({ data: { name: "Worker", email: `${tag}-worker@example.com` } })).id;
  for (const suffix of ["a", "b"]) {
    const studioId = (await platformDb.studio.create({ data: { name: tag, publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}` } })).id;
    studios.push(studioId);
    const db = studioDb(studioId);
    await db.membership.create({ data: { studioId, userId: owner, role: "owner" } });
    await db.membership.create({ data: { studioId, userId: worker, role: "worker" } });
    const client = await db.client.create({ data: { studioId, name: `Klient ${suffix}`, email: `${tag}-${suffix}@example.com` } });
    const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Porsche", model: "Panamera", plate: "WA 911PC" } });
    await seedServices(studioId);
    const services = await db.service.findMany({ where: { code: { in: ["correction", "ceramic"] } }, orderBy: { sort: "asc" } });
    fixtures.push({ clientId: client.id, vehicleId: vehicle.id, items: services.map((service) => ({ serviceId: service.id, name: service.name, basePrice: service.basePrice.toFixed(2), durationMin: service.durationMin })) });
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { id: { in: [owner, worker] } } });
});

describe("quote persistence and e-mail outbox (Postgres)", () => {
  it("persists Decimal totals and replaces items on subsequent saves", async () => {
    const draft = input();
    const db = studioDb(studios[0]!);
    const saved = await saveQuote(studios[0]!, owner, draft);
    await saveQuote(studios[0]!, owner, { ...draft, ...saved, notes: "Nowe uwagi" });
    const quote = await db.quote.findFirstOrThrow({ where: { id: saved.id }, include: { items: true } });
    expect(quote.status).toBe("draft");
    expect(quote.totalGross.toFixed(2)).toBe("4800.00");
    expect(quote.vatAmount.toFixed(2)).toBe("897.56");
    expect(quote.items).toHaveLength(2);
    expect(quote.notes).toBe("Nowe uwagi");
    await expect(saveQuote(studios[0]!, owner, { ...draft, ...saved })).rejects.toThrow(/Odśwież/);
  });

  it("sends and resends without duplicating items, retries SMTP errors and skips completed jobs", async () => {
    const studioId = studios[0]!;
    const db = studioDb(studioId);
    const draft = input();
    const saved = await saveQuote(studioId, owner, draft);
    const { emailId } = await sendQuote(studioId, saved.id, "http://localhost:3000");
    expect((await sendQuote(studioId, saved.id, "http://localhost:3000")).emailId).toBe(emailId);
    const email = await db.quoteEmail.findFirstOrThrow({ where: { id: emailId } });
    expect(email.text).toContain("4800.00 PLN");
    expect(email.text).toContain("897.56 PLN");
    expect(email.text).toContain("Proponowane przyjęcie: 24.10, 08:00");
    expect(email.text).toContain("Zespół " + tag);
    expect(email.text).toContain("http://localhost:3000/p/quote-preview");
    expect(email.recipient).toBe(`${tag}-a@example.com`);
    expect(await db.quoteItem.count({ where: { quoteId: saved.id } })).toBe(2);
    await expect(saveQuote(studioId, owner, { ...draft, ...saved, revision: saved.revision + 2 })).rejects.toThrow(/Odśwież/);
    const smtp = vi.fn().mockRejectedValueOnce(new Error("SMTP down")).mockResolvedValue(undefined);
    await expect(deliverQuoteEmail({ studioId, emailId }, smtp)).rejects.toThrow("SMTP down");
    expect((await db.quote.findFirstOrThrow({ where: { id: saved.id } })).status).toBe("draft");
    await deliverQuoteEmail({ studioId, emailId }, smtp);
    await deliverQuoteEmail({ studioId, emailId }, smtp);
    expect(smtp).toHaveBeenCalledTimes(2);
    const sent = await db.quote.findFirstOrThrow({ where: { id: saved.id } });
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeInstanceOf(Date);
    const resend = await sendQuote(studioId, saved.id, "http://localhost:3000");
    expect(resend.emailId).not.toBe(emailId);
    await deliverQuoteEmail({ studioId, emailId: resend.emailId }, smtp);
    expect(await db.quoteItem.count({ where: { quoteId: saved.id } })).toBe(2);
    expect(await db.quote.count({ where: { id: saved.id } })).toBe(1);
  });

  it("keeps the outbox after a queue outage and relays IDs only", async () => {
    const studioId = studios[0]!;
    const saved = await saveQuote(studioId, owner, input());
    const { emailId } = await sendQuote(studioId, saved.id, "http://localhost:3000");
    await expect(relayQuoteEmails(async () => { throw new Error("Redis down"); })).rejects.toThrow("Redis down");
    const enqueue = vi.fn().mockResolvedValue(undefined);
    await relayQuoteEmails(enqueue);
    expect(enqueue).toHaveBeenCalledWith({ studioId, emailId });
    expect(Object.keys(enqueue.mock.calls[0]![0]).sort()).toEqual(["emailId", "studioId"]);
  });

  it("serializes concurrent saves and send requests", async () => {
    const studioId = studios[0]!;
    const draft = input();
    const saved = await saveQuote(studioId, owner, draft);
    const saves = await Promise.allSettled([saveQuote(studioId, owner, { ...draft, ...saved }), saveQuote(studioId, owner, { ...draft, ...saved })]);
    expect(saves.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const sends = await Promise.allSettled([sendQuote(studioId, draft.id, "http://localhost:3000"), sendQuote(studioId, draft.id, "http://localhost:3000")]);
    expect(sends.some((result) => result.status === "fulfilled")).toBe(true);
    expect(await studioDb(studioId).quoteEmail.count({ where: { quoteId: draft.id } })).toBe(1);
    expect(await studioDb(studioId).quoteItem.count({ where: { quoteId: draft.id } })).toBe(2);
  });

  it("validates recipients and status without leaving an outbox row", async () => {
    const studioId = studios[1]!;
    const db = studioDb(studioId);
    const saved = await saveQuote(studioId, owner, input(1));
    await db.client.updateMany({ where: { id: fixtures[1]!.clientId }, data: { email: null } });
    await expect(sendQuote(studioId, saved.id, "http://localhost:3000")).rejects.toThrow(/adres e-mail/);
    expect(await db.quoteEmail.count({ where: { quoteId: saved.id } })).toBe(0);
    await db.client.updateMany({ where: { id: fixtures[1]!.clientId }, data: { email: `${tag}-b@example.com` } });
    await db.quote.updateMany({ where: { id: saved.id }, data: { status: "accepted" } });
    await expect(sendQuote(studioId, saved.id, "http://localhost:3000")).rejects.toThrow(/Odśwież/);
  });

  it("isolates quotes, items, vehicles, catalog and worker delivery between tenants", async () => {
    const [a, b] = studios as [string, string];
    const draft = input(1);
    const saved = await saveQuote(b, owner, draft);
    await expect(sendQuote(a, saved.id, "http://localhost:3000")).rejects.toMatchObject({ status: 404 });
    await expect(saveQuote(a, owner, { ...input(), vehicleId: fixtures[1]!.vehicleId })).rejects.toMatchObject({ status: 404 });
    await expect(saveQuote(a, owner, { ...input(), items: fixtures[1]!.items })).rejects.toMatchObject({ status: 404 });
    const { emailId } = await sendQuote(b, saved.id, "http://localhost:3000");
    const smtp = vi.fn();
    await deliverQuoteEmail({ studioId: a, emailId }, smtp);
    expect(smtp).not.toHaveBeenCalled();
    expect(await studioDb(a).quoteItem.count({ where: { quoteId: saved.id } })).toBe(0);
    expect(await studioDb(a).quoteEmail.count({ where: { id: emailId } })).toBe(0);
    const serviceId = fixtures[1]!.items[0]!.serviceId;
    await expect(updateService(a, serviceId, { name: "Obca", basePrice: "1.00", durationMin: 1 })).rejects.toMatchObject({ status: 404 });
    const loaded = await loadQuoteWizard(a, owner);
    expect(loaded.clients.some((client) => client.id === fixtures[1]!.clientId)).toBe(false);
    expect(loaded.services.some((service) => service.id === serviceId)).toBe(false);
  });

  it("seeds a studio catalog idempotently and preserves edits and quote snapshots", async () => {
    const studioId = studios[0]!;
    const saved = await saveQuote(studioId, owner, input());
    const serviceId = fixtures[0]!.items[0]!.serviceId;
    await updateService(studioId, serviceId, { name: "Korekta premium", basePrice: "2100.50", durationMin: 410 });
    await seedServices(studioId);
    expect(await studioDb(studioId).service.count()).toBe(4);
    expect((await studioDb(studioId).service.findFirstOrThrow({ where: { id: serviceId } })).basePrice.toFixed(2)).toBe("2100.50");
    const loaded = await loadQuoteWizard(studioId, owner);
    expect(loaded.quote?.id).toBe(saved.id);
    expect(loaded.quote?.items[0]?.basePrice).toBe("2000.00");
    expect(loaded.quote?.draft.serviceIds).toEqual(fixtures[0]!.items.map((item) => item.serviceId));
  });

  it("restricts quote mutations to owners and managers", async () => {
    await expect(authorizeStudio(owner, studios[0]!, "quotes:manage")).resolves.toBeDefined();
    await expect(authorizeStudio(worker, studios[0]!, "quotes:manage")).rejects.toMatchObject({ status: 403 });
  });

  it.runIf(process.env.MAILPIT_TEST === "1")("delivers a real SMTP message to local Mailpit", async () => {
    const studioId = studios[1]!;
    const saved = await saveQuote(studioId, owner, input(1));
    const { emailId } = await sendQuote(studioId, saved.id, "http://localhost:3000");
    await deliverQuoteEmail({ studioId, emailId });
    const response = await fetch("http://localhost:8025/api/v1/search?query=" + encodeURIComponent(`to:${tag}-b@example.com`));
    const body = await response.json();
    expect(body.messages.length).toBeGreaterThan(0);
    expect((await studioDb(studioId).quote.findFirstOrThrow({ where: { id: saved.id } })).status).toBe("sent");
  });
});
