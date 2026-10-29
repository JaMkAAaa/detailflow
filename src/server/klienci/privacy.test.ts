import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { exportClientData, eraseClientData } from "./privacy";
import { invoiceFixture } from "../../invoices/fixtures/document";
import { POST } from "../../../app/api/studios/[studioId]/clients/[clientId]/privacy/route";
import { GET as downloadInvoice } from "../../../app/api/studios/[studioId]/invoices/[invoiceId]/[format]/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn(), deleteObject: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../../../lib/storage", () => ({ deleteObject: mocks.deleteObject }));
const tag = randomUUID();
let a: string, b: string, manager: string, worker: string, owner: string;
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: {
    status: "active", publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix,
    nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa",
  } })));
  [a, b] = studios.map(s => s.id) as [string, string];
  for (const role of ["manager", "worker", "owner"] as const) {
    const user = await platformDb.user.create({ data: { name: role, email: `${tag}-${role}@example.com` } });
    if (role === "manager") manager = user.id;
    if (role === "worker") worker = user.id;
    if (role === "owner") owner = user.id;
    await studioDb(a).membership.create({ data: { studioId: a, userId: user.id, role } });
  }
});
afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: [a, b] } } });
  await platformDb.studio.deleteMany({ where: { id: { in: [a, b] } } });
  await platformDb.user.deleteMany({ where: { id: { in: [manager, worker, owner] } } });
});
async function fixture(studioId: string, withOrder = true) {
  const db = studioDb(studioId);
  const client = await db.client.create({ data: { studioId, name: "Prywatna Osoba", email: "secret@example.com", phone: "+48600111222", street: "Prywatna 1", nip: "123", city: "Warszawa" } });
  const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "BMW", model: "X3", plate: "SECRET" } });
  const quote = await db.quote.create({ data: {
    studioId, clientId: client.id, vehicleId: vehicle.id, status: "accepted", notes: "Osobista notatka", sizeMult: "1", paintMult: "1", totalGross: "4800.00", vatAmount: "897.56",
  } });
  if (!withOrder) return { client, vehicle, quote, order: null, invoice: null, photo: null, protocol: null };
  const document = invoiceFixture();
  const order = await db.workOrder.create({ data: { studioId, clientId: client.id, vehicleId: vehicle.id, quoteId: quote.id,
    number: `DF-${randomUUID()}`, service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), ...document.order,
  } });
  const { items, ...invoiceData } = document.invoice;
  const invoice = await db.invoice.create({ data: { ...invoiceData, id: undefined, studioId, number: randomUUID(), workOrderId: order.id, ksefNumber: null,
    items: { create: items.map(line => ({ ...line, id: undefined, studioId: undefined, invoiceId: undefined })) },
  } });
  await db.ksefSubmission.create({ data: { studioId, invoiceId: invoice.id, xml: "<immutable>snapshot</immutable>", xmlHash: "hash" } });
  const photo = await db.orderPhoto.create({ data: { studioId, workOrderId: order.id, no: 1, stage: 1, key: `studios/${studioId}/orders/${order.id}/photo.jpg`, contentType: "image/jpeg", sizeBytes: 10, uploadedAt: new Date(), createdAt: new Date(Date.now() - 600_000) } });
  const protocol = await db.intakeProtocol.create({ data: { studioId, workOrderId: order.id, number: randomUUID(), acceptedAt: new Date(),
    damages: { create: [{ no: 1, title: "Rysa", part: "Drzwi", posX: 0, posY: 0, photoId: photo.id }] },
  } });
  await db.portalLink.create({ data: { studioId, workOrderId: order.id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 86400000) } });
  await db.quoteSendMail.create({ data: { studioId, quoteId: quote.id } });
  return { client, vehicle, quote, order, invoice, photo, protocol };
}
const context = (studioId: string, clientId: string) => ({ params: Promise.resolve({ studioId, clientId }) });
const request = (action = "export", origin = "http://localhost:3000") => new Request("http://localhost:3000/api/privacy", {
  method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ action }),
});

it("exports the client's records and portal metadata without tokens, hashes, storage keys or other tenants", async () => {
  const one = await fixture(a), other = await fixture(b);
  const result = await exportClientData(a, one.client.id, manager);
  expect(result.client.email).toBe("secret@example.com");
  expect(result.vehicles.map(v => v.id)).toEqual([one.vehicle.id]);
  expect(result.orders[0]?.totalGross.toFixed(2)).toBe("4800.00");
  expect(result.quotes[0]?.notes).toBe("Osobista notatka");
  expect(result.portalLinks).toHaveLength(1);
  const json = JSON.stringify(result);
  for (const forbidden of ["tokenHash", "token", "key", other.client.id]) expect(json).not.toContain(forbidden);
  await expect(exportClientData(a, other.client.id, manager)).rejects.toMatchObject({ status: 404 });
  await expect(eraseClientData(a, other.client.id, manager)).rejects.toMatchObject({ status: 404 });
  expect((await studioDb(b).client.findFirstOrThrow({ where: { id: other.client.id } })).email).toBe("secret@example.com");
});

it("anonymizes contact, plates and notes, deletes S3 photos, revokes links, preserves accepted protocol and accounting snapshots", async () => {
  const f = await fixture(a);
  const db = studioDb(a);
  mocks.deleteObject.mockResolvedValue(undefined);
  expect(await eraseClientData(a, f.client.id, manager)).toEqual({ outcome: "anonymized" });
  expect(mocks.deleteObject).toHaveBeenCalledWith(f.photo!.key);
  expect(await db.client.findFirstOrThrow({ where: { id: f.client.id } })).toMatchObject({ name: "Klient zanonimizowany", phone: null, email: null, street: null, nip: null });
  expect(await db.vehicle.findFirstOrThrow({ where: { id: f.vehicle.id } })).toMatchObject({ plate: "USUNIĘTO" });
  expect(await db.quote.findFirstOrThrow({ where: { id: f.quote.id } })).toMatchObject({ notes: null });
  expect(await db.orderPhoto.count({ where: { workOrderId: f.order!.id } })).toBe(0);
  expect(await db.portalLink.findFirstOrThrow({ where: { workOrderId: f.order!.id } })).toMatchObject({ revokedAt: expect.any(Date) });
  expect(await db.quoteSendMail.count({ where: { quoteId: f.quote.id } })).toBe(0);
  expect(await db.intakeProtocol.findFirstOrThrow({ where: { id: f.protocol!.id } })).toMatchObject({ acceptedAt: f.protocol!.acceptedAt });
  expect(await db.intakeDamage.findFirstOrThrow({ where: { protocolId: f.protocol!.id } })).toMatchObject({ title: "Rysa", part: "Drzwi", photoId: null });
  expect(await db.invoice.findFirstOrThrow({ where: { id: f.invoice!.id } })).toEqual(f.invoice);
  expect(await db.ksefSubmission.findFirstOrThrow({ where: { invoiceId: f.invoice!.id } })).toMatchObject({ xml: "<immutable>snapshot</immutable>", xmlHash: "hash" });
  mocks.session.mockResolvedValue({ user: { id: manager } });
  const pdfResponse = await downloadInvoice(new Request("http://localhost:3000/api/pdf?env=test"), { params: Promise.resolve({ studioId: a, invoiceId: f.invoice!.id, format: "pdf" }) });
  expect(pdfResponse.status).toBe(200);
  const task = getDocument({ data: new Uint8Array(await pdfResponse.arrayBuffer()), useSystemFonts: false });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const text = (await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" ");
  expect(text).toContain(f.invoice!.number);
  expect(text).not.toContain("secret@example.com"); expect(text).not.toContain("600111222");
  await task.destroy();
  await expect(eraseClientData(a, f.client.id, manager)).resolves.toEqual({ outcome: "anonymized" });
});

it("retains rows on S3 failure and supports retry without deleting another customer's photos", async () => {
  const f = await fixture(a), other = await fixture(a);
  mocks.deleteObject.mockRejectedValueOnce(new Error("S3 unavailable"));
  await expect(eraseClientData(a, f.client.id, manager)).rejects.toThrow("S3 unavailable");
  expect(await studioDb(a).orderPhoto.count({ where: { id: f.photo!.id } })).toBe(1);
  expect((await studioDb(a).client.findFirstOrThrow({ where: { id: f.client.id } })).email).toBe("secret@example.com");
  mocks.deleteObject.mockResolvedValue(undefined);
  await eraseClientData(a, f.client.id, manager);
  expect(await studioDb(a).orderPhoto.count({ where: { id: other.photo!.id } })).toBe(1);
});

it("hard deletes history-free clients including quote-only clients and their cars", async () => {
  const f = await fixture(a, false);
  expect(await eraseClientData(a, f.client.id, manager)).toEqual({ outcome: "deleted" });
  expect(await studioDb(a).client.count({ where: { id: f.client.id } })).toBe(0);
  expect(await studioDb(a).vehicle.count({ where: { id: f.vehicle.id } })).toBe(0);
  expect(await studioDb(a).quote.count({ where: { id: f.quote.id } })).toBe(0);
});

it("requires owner/manager, session and Origin for both actions and returns no-store downloads", async () => {
  const f = await fixture(a, false);
  for (const action of ["export", "erase"]) {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request(action), context(a, f.client.id))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: worker } });
    expect((await POST(request(action), context(a, f.client.id))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { id: manager } });
    expect((await POST(request(action, "https://evil.test"), context(a, f.client.id))).status).toBe(403);
    expect((await POST(request(action), context(b, f.client.id))).status).toBe(403);
  }
  for (const userId of [owner, manager]) {
    mocks.session.mockResolvedValue({ user: { id: userId } });
    const response = await POST(request(), context(a, f.client.id));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
  }
  expect((await POST(request("invalid"), context(a, f.client.id))).status).toBe(400);
  const audit = await platformDb.auditLog.findMany({ where: { studioId: a, action: { startsWith: "client.privacy." } } });
  expect(audit.length).toBeGreaterThan(0);
  for (const event of audit) {
    expect(Object.keys(event.meta as object).every(key => ["clientId", "outcome"].includes(key))).toBe(true);
    expect(JSON.stringify(event.meta)).not.toContain("secret@example.com");
  }
});

it("retains and anonymizes an order without an invoice, and deletes a client with no history", async () => {
  const db = studioDb(a);
  const client = await db.client.create({ data: { studioId: a, name: "Bez historii" } });
  await expect(eraseClientData(a, client.id, manager)).resolves.toEqual({ outcome: "deleted" });
  const withOrder = await db.client.create({ data: { studioId: a, name: "Ze zleceniem", phone: "123456789" } });
  const car = await db.vehicle.create({ data: { studioId: a, clientId: withOrder.id, make: "BMW", model: "X3", plate: "TEST" } });
  const order = await db.workOrder.create({ data: { studioId: a, clientId: withOrder.id, vehicleId: car.id, number: randomUUID(),
    status: "accepted", service: "Mycie", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "100.00",
  } });
  await expect(eraseClientData(a, withOrder.id, manager)).resolves.toEqual({ outcome: "anonymized" });
  expect(await db.workOrder.count({ where: { id: order.id } })).toBe(1);
  expect((await db.client.findFirstOrThrow({ where: { id: withOrder.id } })).phone).toBeNull();
});


it("refuses erasure while a signed PUT can recreate the object after deletion", async () => {
  const f = await fixture(a);
  await studioDb(a).orderPhoto.updateMany({ where: { id: f.photo!.id }, data: { createdAt: new Date() } });
  mocks.deleteObject.mockClear();
  await expect(eraseClientData(a, f.client.id, manager)).rejects.toMatchObject({ status: 409 });
  expect(mocks.deleteObject).not.toHaveBeenCalled();
  expect(await studioDb(a).orderPhoto.count({ where: { id: f.photo!.id } })).toBe(1);
});
