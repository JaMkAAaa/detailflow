import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceFixture } from "@/src/invoices/fixtures/document";
import { invoiceDocument } from "./document";
import { invoiceDetail } from "./query";
import { deliverInvoiceMails, requestInvoiceMail } from "./mail";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail: mocks.send }) }));
const tag = randomUUID();
let a: string, b: string, id: string, clientId: string;
const db = () => studioDb(b);
const invoice = () => db().invoice.findFirstOrThrow({ where: { id } });
const mail = () => db().invoiceMail.findFirstOrThrow({ where: { invoiceId: id, sentAt: null } });
const ready = () => db().invoiceMail.updateMany({ where: { invoiceId: id, sentAt: null }, data: { nextAttemptAt: new Date(0) } });
const request = () => requestInvoiceMail(b, id, { env: "test" });
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix, nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa" } }).then(s => s.id)));
  a = studios[0]!; b = studios[1]!;
  const client = await db().client.create({ data: { studioId: b, name: "Buyer", email: "buyer@example.com" } }); clientId = client.id;
  const vehicle = await db().vehicle.create({ data: { studioId: b, clientId, make: "BMW", model: "X3", plate: tag } });
  const fixture = invoiceFixture();
  const order = await db().workOrder.create({ data: { studioId: b, clientId, vehicleId: vehicle.id, number: "DF-0243", service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), ...fixture.order } });
  const { items, ...source } = fixture.invoice;
  const result = await db().invoice.create({ data: { ...source, id: undefined, studioId: b, workOrderId: order.id, ksefNumber: null,
    items: { create: items.map(line => ({ ...line, id: undefined, studioId: undefined, invoiceId: undefined })) },
  } }); id = result.id;
});
afterAll(async () => { await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); mocks.send.mockReset(); });
it("rejects a foreign tenant, a wrong environment and missing/invalid email without queueing", async () => {
  await expect(requestInvoiceMail(a, id, { env: "test" })).rejects.toMatchObject({ status: 404 });
  await expect(requestInvoiceMail(b, id, { env: "production" })).rejects.toMatchObject({ status: 404 });
  for (const email of [null, "broken"]) {
    await db().client.update({ where: { id: clientId }, data: { email } });
    await expect(request()).rejects.toMatchObject({ status: 400 });
  }
  expect(await db().invoiceMail.count()).toBe(0);
  await db().client.update({ where: { id: clientId }, data: { email: "buyer@example.com" } });
});
it("coalesces simultaneous clicks, snapshots recipient, preserves last delivery and PDF download does not mark sent", async () => {
  const old = (await invoice()).emailedAt;
  const results = await Promise.all([request(), request()]);
  expect(results[0]?.id).toBe(results[1]?.id);
  expect(await db().invoiceMail.count()).toBe(1);
  expect((await invoiceDetail(b, (await invoice()).number, "test"))?.mailPending).toBe(true);
  await invoiceDocument(b, id, "test");
  expect((await invoice()).emailedAt).toEqual(old);
  await db().client.update({ where: { id: clientId }, data: { email: "changed@example.com" } });
  expect((await mail()).recipient).toBe("buyer@example.com");
});
it("logs a secret-free dev preview without pretending delivery when SMTP is missing", async () => {
  vi.stubEnv("SMTP_URL", ""); vi.stubEnv("NODE_ENV", "development");
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  const old = (await invoice()).emailedAt;
  await deliverInvoiceMails();
  expect(log).toHaveBeenCalledWith(expect.stringContaining("DOKUMENT TESTOWY"));
  expect(log.mock.calls.flat().join(" ")).not.toMatch(/example.com|\/p\/|<Faktura|token/i);
  expect(mocks.send).not.toHaveBeenCalled();
  expect((await mail()).sentAt).toBeNull();
  expect((await invoice()).emailedAt).toEqual(old);
});
it("retains the outbox on SMTP failure, retries with PDF and only then records the timestamp", async () => {
  vi.stubEnv("SMTP_URL", "smtp://unused.invalid");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const old = (await invoice()).emailedAt;
  await ready(); mocks.send.mockRejectedValueOnce(new Error("secret SMTP error"));
  await deliverInvoiceMails();
  const pending = await mail();
  expect(pending.attempts).toBe(1);
  expect(pending.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  expect((await invoice()).emailedAt).toEqual(old);
  await ready(); mocks.send.mockResolvedValue({ accepted: ["buyer@example.com"] });
  await Promise.all([deliverInvoiceMails(), deliverInvoiceMails()]);
  expect(mocks.send).toHaveBeenCalledTimes(2); // jedna nieudana próba, jedna udana
  const payload = mocks.send.mock.calls[1]![0];
  expect(payload.to).toBe("buyer@example.com"); expect(payload.subject).toContain("[TEST]");
  expect(payload.text).not.toMatch(/\/p\/|<Faktura|token/i);
  expect(payload.attachments).toHaveLength(1);
  expect(payload.attachments[0].content.subarray(0, 4).toString()).toBe("%PDF");
  const sent = await db().invoiceMail.findFirstOrThrow({ where: { id: pending.id } });
  expect(sent.sentAt).not.toBeNull(); expect((await invoice()).emailedAt).toEqual(sent.sentAt);
  expect((await invoiceDetail(b, (await invoice()).number, "test"))?.mailPending).toBe(false);
  await deliverInvoiceMails(); expect(mocks.send).toHaveBeenCalledTimes(2);
});
it("creates a separate resend and treats SMTP recipient rejection as a failure", async () => {
  vi.stubEnv("SMTP_URL", "smtp://unused.invalid");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const old = (await invoice()).emailedAt;
  await request(); expect(await db().invoiceMail.count()).toBe(2);
  expect((await invoice()).emailedAt).toEqual(old);
  mocks.send.mockResolvedValue({ accepted: [] });
  await deliverInvoiceMails(); expect((await mail()).sentAt).toBeNull();
  expect((await invoice()).emailedAt).toEqual(old);
});
