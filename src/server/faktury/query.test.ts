import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceDetail, invoiceOrders, invoiceRecord } from "./query";
import { invoiceAttentionCount, invoiceList } from "./list-query";

const tag = randomUUID();
let a: string;
let b: string;
let invoiceId: string;
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix } })));
  a = studios[0]!.id; b = studios[1]!.id;
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Private buyer", email: "buyer@example.com" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "BMW", model: "X3", plate: tag } });
  const base = { studioId: b, clientId: client.id, vehicleId: vehicle.id, service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "4800" };
  const order = await db.workOrder.create({ data: { ...base, number: "DF-0243", status: "completed", completedAt: new Date() } });
  await db.workOrder.create({ data: { ...base, number: "DF-0248", status: "in_progress" } });
  for (const env of ["test", "production"] as const) {
    const invoice = await db.invoice.create({ data: { studioId: b, workOrderId: order.id, number: "FV/41/10/2026", status: "issued", ksefEnv: env, ksefStatus: "accepted", buyerName: env, totalNet: "3902.44", totalVat: "897.56", totalGross: "4800", items: { create: [{ name: `Korekta ${env}`, lp: 1, quantity: "1", unit: "usł.", unitNet: "3902.44", vatRate: 23, net: "3902.44", vat: "897.56", gross: "4800" }] }, events: { create: [{ kind: "issued", at: new Date(), message: "Issued" }] } } });
    if (env === "test") invoiceId = invoice.id;
  }
});
afterAll(async () => { await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); });
it("isolates invoice numbers, IDs, lines, events and completed work orders by studio", async () => {
  expect(await invoiceDetail(a, "FV/41/10/2026", "test")).toBeNull();
  expect(await invoiceRecord(a, { id: invoiceId })).toBeNull();
  expect(await invoiceOrders(a, "test")).toEqual([]);
  const invoice = await invoiceDetail(b, "FV/41/10/2026", "test");
  expect(invoice?.buyer.name).toBe("test");
  expect(invoice?.items).toHaveLength(1);
  expect(invoice?.events).toHaveLength(1);
  const orders = await invoiceOrders(b, "test");
  expect(orders.map(order => order.number)).toEqual(["DF-0243"]);
  expect(orders[0]?.items[0]?.unitNet).toBe("3902.44");
  expect(orders[0]?.items[0]?.name).toBe("Korekta test");
  expect((await invoiceOrders(b, "production"))[0]?.items[0]?.name).toBe("Korekta production");
});
it("keeps identically numbered TEST and PROD invoices separate", async () => {
  expect((await invoiceDetail(b, "FV/41/10/2026", "test"))?.buyer.name).toBe("test");
  expect((await invoiceDetail(b, "FV/41/10/2026", "production"))?.buyer.name).toBe("production");
});
it("isolates list rows, events and attention counts by studio and environment", async () => {
  expect(await invoiceList(a, "test")).toEqual([]);
  expect(await invoiceAttentionCount(a, "test")).toBe(0);
  const testRows = await invoiceList(b, "test");
  const prodRows = await invoiceList(b, "production");
  expect(testRows.map(row => row.buyerName)).toEqual(["test"]);
  expect(prodRows.map(row => row.buyerName)).toEqual(["production"]);
  expect(testRows[0]?.events).toHaveLength(1);
  await studioDb(b).invoice.update({ where: { id: invoiceId }, data: { ksefStatus: "rejected" } });
  expect(await invoiceAttentionCount(b, "test")).toBe(1);
  expect(await invoiceAttentionCount(b, "production")).toBe(0);
  expect(await invoiceAttentionCount(a, "test")).toBe(0);
});
