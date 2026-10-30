import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceOrders } from "./query";
import { issueInvoice } from "./manage";

const studios: string[] = [];
let a: string;
let b: string;
beforeAll(async () => {
  for (const name of ["a", "b"]) {
    const slug = `invoice-orders-${randomUUID()}`;
    const studio = await platformDb.studio.create({ data: { name, slug, publicCode: slug } });
    studios.push(studio.id);
  }
  [a, b] = studios as [string, string];
  for (const studioId of studios) {
    const db = studioDb(studioId);
    const client = await db.client.create({ data: { studioId, name: "Buyer", email: "buyer@example.com" } });
    const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "BMW", model: "X3", plate: "TEST" } });
    const base = { studioId, clientId: client.id, vehicleId: vehicle.id, service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "123.00" };
    for (const [index, number] of ["unbilled", "test-only", "prod-only", "canceled", "correction", "in-progress", "missing-date"].entries()) {
      const order = await db.workOrder.create({ data: {
        ...base, number, status: number === "in-progress" ? "in_progress" : "completed",
        completedAt: number === "missing-date" ? null : new Date(`2026-10-${10 + index}T12:00:00Z`),
      } });
      // Same order numbers in studio B remain available regardless of invoices in A.
      if (studioId === b || !["test-only", "prod-only", "canceled", "correction"].includes(number)) continue;
      const original = number === "correction" ? await db.invoice.create({ data: {
        studioId, workOrderId: order.id, number: "FV/100/10/2026", status: "canceled", ksefEnv: "test",
        buyerName: "Buyer", totalNet: "100", totalVat: "23", totalGross: "123",
      } }) : null;
      await db.invoice.create({ data: {
        studioId, workOrderId: order.id, number: `${number === "correction" ? "KFV" : "FV"}/${index}/10/2026`,
        status: number === "canceled" ? "canceled" : "issued",
        kind: number === "correction" ? "correction" : "invoice",
        correctsInvoiceId: original?.id,
        ksefEnv: number === "prod-only" ? "production" : "test",
        buyerName: "Buyer", totalNet: "100", totalVat: "23", totalGross: "123",
      } });
    }
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
});

it("excludes active invoices only in the requested environment, newest completion first", async () => {
  expect((await invoiceOrders(a, "test")).map(order => order.number)).toEqual(["correction", "canceled", "prod-only", "unbilled"]);
  expect((await invoiceOrders(a, "production")).map(order => order.number)).toEqual(["correction", "canceled", "test-only", "unbilled"]);
});

it("keeps identically numbered orders in another studio eligible", async () => {
  for (const env of ["test", "production"] as const) {
    expect((await invoiceOrders(b, env)).map(order => order.number)).toEqual(["correction", "canceled", "prod-only", "test-only", "unbilled"]);
  }
});

it("takes invoice items from the completed order", async () => {
  const orders = await invoiceOrders(a, "test");
  expect(orders.find(order => order.number === "unbilled")?.items).toEqual([
    { name: "Detailing", quantity: "1", unitNet: "100.00", vatRate: 23, discount: "0" },
  ]);
});

it("can issue every offered order and removes it from the candidates afterwards", async () => {
  for (const env of ["test", "production"] as const) {
    for (const order of await invoiceOrders(a, env)) {
      const invoice = await issueInvoice(a, env, {
        workOrderId: order.id,
        buyer: { name: "Buyer", street: "Warszawska 1", postal: "00-001", city: "Warszawa" },
        items: order.items.map(({ name, quantity, unitNet, vatRate }) => ({ name, quantity, unitNet, vatRate })), dueDays: 7,
      });
      expect(invoice.ksefEnv).toBe(env);
      expect(invoice.totalGross).toBe("123.00");
    }
    expect(await invoiceOrders(a, env)).toEqual([]);
  }
});
