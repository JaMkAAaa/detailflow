import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { plDate } from "@/src/invoices/document";
import { invoiceDetail } from "./query";
import { generateFa3 } from "@/src/ksef/fa3";
import { invoiceDocument } from "./document";
import { correctInvoice, issueInvoice, markInvoicePaid } from "./manage";

const tag = randomUUID();
const [year, month] = plDate(new Date()).split("-") as [string, string];
const suffix = `/${month}/${year}`;
let a: string, b: string;
const orders: Record<string, string> = {};
const buyer = { name: "Adam Nowak", nip: "526-025-02-74", street: "ul. Puławska 120/4", postal: "02-620", city: "Warszawa" };
const lines = [{ name: "Korekta lakieru · 2 etapy", quantity: "1", unitNet: "1951.22", vatRate: 23 as const }, { name: "Powłoka ceramiczna 3 lata", quantity: "1", unitNet: "1951.22", vatRate: 23 as const }];
const issue = (studioId: string, workOrderId: string, env: "test" | "production" = "test") => issueInvoice(studioId, env, { workOrderId, buyer, items: lines });

beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(s => platformDb.studio.create({ data: { publicCode: `${tag}-${s}`, slug: `${tag}-${s}`, name: s, nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa" } })));
  a = studios[0]!.id; b = studios[1]!.id;
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Adam Nowak" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "Porsche", model: "911", plate: tag } });
  const base = { studioId: b, clientId: client.id, vehicleId: vehicle.id, service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "4800" };
  const statuses = { "DF-0243": "completed", "DF-0244": "completed", "DF-0245": "completed", "DF-0246": "completed", "DF-0247": "accepted", "DF-0248": "in_progress", "DF-0249": "ready_for_pickup", "DF-0250": "canceled" } as const;
  for (const [number, status] of Object.entries(statuses)) {
    const order = await db.workOrder.create({ data: { ...base, number, status, completedAt: status === "completed" ? new Date() : null } });
    orders[number] = order.id;
  }
  // Wcześniejsza faktura z seeda: numeracja ma kontynuować od FV/41.
  await db.invoice.create({ data: { studioId: b, workOrderId: orders["DF-0244"]!, number: `FV/41${suffix}`, status: "issued", ksefEnv: "test", ksefStatus: "accepted", buyerName: "x", issuedAt: new Date(), saleAt: new Date(), totalNet: "3902.44", totalVat: "897.56", totalGross: "4800" } });
});
afterAll(async () => { await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); });

it("rejects invoices for orders that are not completed and accepts the completed one", async () => {
  for (const number of ["DF-0247", "DF-0248", "DF-0249", "DF-0250"]) {
    await expect(issue(b, orders[number]!)).rejects.toMatchObject({ status: 409, message: expect.stringContaining(`#${number}`) });
  }
  expect(await studioDb(b).invoice.count({ where: { workOrderId: { in: ["DF-0247", "DF-0248", "DF-0249", "DF-0250"].map(n => orders[n]!) } } })).toBe(0);
  const invoice = await issue(b, orders["DF-0243"]!);
  expect(invoice.number).toBe(`FV/42${suffix}`);
  expect(invoice.totalGross).toBe("4800.00");
  const detail = await invoiceDetail(b, invoice.number, "test");
  expect(detail).toMatchObject({ status: "issued", ksefStatus: "not_sent", totalNet: "3902.44", totalVat: "897.56", buyer: { nip: "5260250274" } });
  expect(detail?.events.map(e => e.kind)).toEqual(["issued"]);
});
it("validates amounts, duplicates and tenants when issuing", async () => {
  await expect(issueInvoice(b, "test", { workOrderId: orders["DF-0245"], buyer, items: [{ ...lines[0]!, unitNet: "100" }] })).rejects.toMatchObject({ status: 400 });
  await expect(issueInvoice(b, "test", { workOrderId: orders["DF-0245"], buyer: { ...buyer, nip: "5260250275" }, items: lines })).rejects.toThrow();
  await expect(issue(b, orders["DF-0243"]!)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ma już fakturę") });
  await expect(issue(a, orders["DF-0245"]!)).rejects.toMatchObject({ status: 404 });
  await expect(issue(b, "missing")).rejects.toMatchObject({ status: 404 });
});
it("keeps TEST and PROD numbering separate and survives parallel issuing", async () => {
  expect((await issue(b, orders["DF-0245"]!, "production")).number).toBe(`FV/1${suffix}`);
  const results = await Promise.allSettled([issue(b, orders["DF-0246"]!), issue(b, orders["DF-0246"]!)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  expect(await studioDb(b).invoice.count({ where: { workOrderId: orders["DF-0246"]!, kind: "invoice" } })).toBe(1);
});

it("marks an invoice as paid once, atomically and within its studio", async () => {
  const id = (await studioDb(b).invoice.findFirstOrThrow({ where: { number: `FV/42${suffix}` } })).id;
  await expect(markInvoicePaid(a, id, {})).rejects.toMatchObject({ status: 404 });
  await expect(markInvoicePaid(b, id, { paidAt: new Date(Date.now() + 86_400_000).toISOString() })).rejects.toMatchObject({ status: 400 });
  await expect(markInvoicePaid(b, id, { paidAt: "2020-01-01T00:00:00Z" })).rejects.toMatchObject({ status: 400 });
  await expect(markInvoicePaid(b, id, { paid: true })).rejects.toThrow();
  expect(await studioDb(b).invoice.findFirstOrThrow({ where: { id } }).then(i => i.paidAt)).toBeNull();
  const results = await Promise.allSettled([markInvoicePaid(b, id, {}), markInvoicePaid(b, id, {})]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  const paid = await studioDb(b).invoice.findFirstOrThrow({ where: { id } });
  expect(paid.paidAt).not.toBeNull();
  await expect(markInvoicePaid(b, id, {})).rejects.toMatchObject({ status: 409, message: expect.stringContaining("już oznaczona") });
  expect((await invoiceDetail(b, paid.number, "test"))?.paidAt).toBe(paid.paidAt!.toISOString());
});

it("issues corrections as linked documents, chained and tenant-scoped", async () => {
  const source = await studioDb(b).invoice.findFirstOrThrow({ where: { number: `FV/42${suffix}` }, include: { items: true } });
  const lp2 = source.items.find(i => i.lp === 2)!;
  await expect(correctInvoice(b, source.id, { reason: "Rabat", items: [{ lp: 2, quantity: "1", unitNet: "1000" }] })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("KSeF") });
  await studioDb(b).invoice.update({ where: { id: source.id }, data: { ksefStatus: "accepted", ksefNumber: `9512345678-20261024-${tag.replaceAll("-", "").slice(0, 12).toUpperCase()}-5D` } });
  await expect(correctInvoice(a, source.id, { reason: "Rabat", items: [{ lp: 2, quantity: "1", unitNet: "1000" }] })).rejects.toMatchObject({ status: 404 });
  await expect(correctInvoice(b, source.id, { reason: "Nic", items: [{ lp: 2, quantity: "1", unitNet: lp2.unitNet.toString() }] })).rejects.toMatchObject({ status: 400 });
  await expect(correctInvoice(b, source.id, { reason: "Zły lp", items: [{ lp: 9, quantity: "1", unitNet: "1" }] })).rejects.toMatchObject({ status: 400 });
  await expect(correctInvoice(b, source.id, { reason: " ", items: [{ lp: 2, quantity: "1", unitNet: "1" }] })).rejects.toThrow();

  const first = await correctInvoice(b, source.id, { reason: "Rabat na ceramikę", items: [{ lp: 2, quantity: "1", unitNet: "1000.00" }] });
  expect(first).toMatchObject({ number: `KFV/1${suffix}`, correctsNumber: source.number, totalGross: "-1170.00" });
  const detail = await invoiceDetail(b, first.number, "test");
  expect(detail).toMatchObject({ kind: "correction", correctsNumber: source.number, correctionReason: "Rabat na ceramikę", totalNet: "-951.22", totalVat: "-218.78", ksefStatus: "not_sent" });
  expect(detail?.items).toEqual([{ name: "Powłoka ceramiczna 3 lata (korekta)", quantity: "1", unitNet: "-951.22", vatRate: 23, discount: "0" }]);
  expect((await invoiceDetail(b, source.number, "test"))?.corrections).toEqual([{ number: first.number }]);

  // Druga korekta liczy od stanu po pierwszej, nie od faktury źródłowej.
  const second = await correctInvoice(b, source.id, { reason: "Usunięcie ceramiki", items: [{ lp: 2, quantity: "0", unitNet: "1000.00" }] });
  expect(second).toMatchObject({ number: `KFV/2${suffix}`, totalGross: "-1230.00" });
  expect((await studioDb(b).invoice.findFirstOrThrow({ where: { id: source.id } })).totalGross.toString()).toBe("4800");
  await expect(correctInvoice(b, first.id, { reason: "Korekta korekty", items: [{ lp: 1, quantity: "2", unitNet: "1" }] })).rejects.toMatchObject({ status: 409 });
  await expect(markInvoicePaid(b, first.id, {})).rejects.toMatchObject({ status: 409 });
  await expect(invoiceDocument(a, first.id, "test")).rejects.toMatchObject({ status: 404 });
  await expect(invoiceDocument(b, first.id, "production")).rejects.toMatchObject({ status: 404 });
  const document = await invoiceDocument(b, first.id, "test");
  expect(document.corrects?.number).toBe(source.number);
  expect(generateFa3(document)).toContain("<P_15>-1170.00</P_15>");
  const removed = await invoiceDocument(b, second.id, "test");
  expect(removed.invoice.items.find(item => item.lp === 2)?.quantity.toString()).toBe("0");
  expect(generateFa3(removed)).toContain("<P_15>-1230.00</P_15>");
  await correctInvoice(b, source.id, { reason: "Mała usługa", items: [{ lp: 2, quantity: "1", unitNet: "0.03" }] });
  const rounding = await correctInvoice(b, source.id, { reason: "Rabat groszowy", items: [{ lp: 2, quantity: "1", unitNet: "0.02" }] });
  const roundedDocument = await invoiceDocument(b, rounding.id, "test");
  expect(roundedDocument.invoice.totalNet.toFixed(2)).toBe("-0.01");
  expect(roundedDocument.invoice.totalVat.toFixed(2)).toBe("-0.01");
  expect(generateFa3(roundedDocument)).toContain("<P_15>-0.02</P_15>");
});
it("rejects a database row that violates the correction link", async () => {
  const source = await studioDb(b).invoice.findFirstOrThrow({ where: { number: `FV/42${suffix}` } });
  const row = { studioId: b, workOrderId: source.workOrderId, status: "issued" as const, ksefEnv: "test" as const, buyerName: "x", totalNet: "0", totalVat: "0", totalGross: "0" };
  await expect(studioDb(b).invoice.create({ data: { ...row, number: "X1", kind: "correction" } })).rejects.toThrow();
  await expect(studioDb(b).invoice.create({ data: { ...row, number: "X2", kind: "invoice", correctsInvoiceId: source.id } })).rejects.toThrow();
});
