import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceFixture } from "@/src/invoices/fixtures/document";
import { invoiceDocument } from "./document";
import { generateFa3 } from "@/src/ksef/fa3";

const tag = randomUUID();
let a: string, b: string, testId: string;
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix, nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa" } })));
  a = studios[0]!.id; b = studios[1]!.id;
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Buyer" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "BMW", model: "X3", plate: tag } });
  const fixture = invoiceFixture();
  const order = await db.workOrder.create({ data: { studioId: b, clientId: client.id, vehicleId: vehicle.id, number: "DF-0243", service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), ...fixture.order } });
  for (const ksefEnv of ["test", "production"] as const) {
    const { items } = fixture.invoice;
    const invoice = { ...fixture.invoice, id: undefined, studioId: undefined, items: undefined };
    const result = await db.invoice.create({ data: { ...invoice, studioId: b, workOrderId: order.id, buyerName: ksefEnv, ksefEnv, ksefNumber: null,
      items: { create: items.map(line => ({ ...line, id: undefined, studioId: undefined, invoiceId: undefined })) },
    } });
    if (ksefEnv === "test") testId = result.id;
  }
});
afterAll(async () => { await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); });
it("prevents exports across tenants and across environments even with a known invoice ID", async () => {
  await expect(invoiceDocument(a, testId, "test")).rejects.toMatchObject({ status: 404 });
  await expect(invoiceDocument(b, testId, "production")).rejects.toMatchObject({ status: 404 });
  const document = await invoiceDocument(b, testId, "test");
  expect(document.invoice.buyerName).toBe("test");
  expect(document.invoice.items).toHaveLength(2);
  expect(generateFa3(document)).toContain("<P_15>4800.00</P_15>");
  expect(document.invoice.totalNet.plus(document.invoice.totalVat).eq(document.order.totalGross)).toBe(true);
});
