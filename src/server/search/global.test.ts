import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { searchQueryFromUrl, searchStudio } from "./global";

describe("global studio search (Postgres)", () => {
  const tag = randomUUID();
  let studioA: string;
  let studioB: string;

  beforeAll(async () => {
    const studios = await Promise.all(["a", "b"].map((suffix) => platformDb.studio.create({
      data: { publicCode: `search-${tag}-${suffix}`, slug: `search-${tag}-${suffix}`, name: `Search ${suffix}`, ksefEnv: "test" },
    })));
    [studioA, studioB] = studios.map((studio) => studio.id) as [string, string];

    await Promise.all([
      { id: studioA, name: "Alfa Detail Studio", make: "Aston Martin", model: "DBX", plate: "WA 23456", order: "DF-9831", invoice: "FV/73/10/2026", buyer: "Karo Research" },
      { id: studioB, name: "Beta Finish Studio", make: "Bentley", model: "Bentayga", plate: "KR 98765", order: "DF-9832", invoice: "FV/74/10/2026", buyer: "Beta Buyer" },
    ].map(async (fixture) => {
      const db = studioDb(fixture.id);
      const client = await db.client.create({ data: { studioId: fixture.id, name: fixture.name, email: `${fixture.id}@example.test`, phone: "+48 700 111 222" } });
      const vehicle = await db.vehicle.create({ data: { studioId: fixture.id, clientId: client.id, make: fixture.make, model: fixture.model, plate: fixture.plate } });
      const order = await db.workOrder.create({ data: {
        studioId: fixture.id, number: fixture.order, clientId: client.id, vehicleId: vehicle.id,
        status: "accepted", service: "Ceramic coating", stage: 1,
        scheduledFrom: new Date("2026-10-28T08:00:00Z"), scheduledTo: new Date("2026-10-28T10:00:00Z"), totalGross: "1250.00",
      } });
      await db.invoice.create({ data: {
        studioId: fixture.id, number: fixture.invoice, workOrderId: order.id, status: "issued", ksefEnv: "test",
        buyerName: fixture.buyer, totalNet: "1000.00", totalVat: "250.00", totalGross: "1250.00",
      } });
    }));
  });

  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: [studioA, studioB] } } });
  });

  it("returns clients, vehicles, orders and invoices with existing detail routes", async () => {
    const results = await searchStudio(studioA, "WA 23456", "owner");
    expect(results.map((result) => result.type)).toEqual(["vehicle", "order"]);
    expect(results[0]).toMatchObject({ title: "Aston Martin DBX", subtitle: "WA 23456 · Alfa Detail Studio", href: expect.stringMatching(/^\/customers\//) });
    expect(results[1]).toMatchObject({ title: "DF-9831", href: "/orders/DF-9831" });

    expect(await searchStudio(studioA, "Alfa Detail", "owner")).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "client", href: expect.stringMatching(/^\/customers\//) }),
      expect.objectContaining({ type: "vehicle" }),
      expect.objectContaining({ type: "order" }),
    ]));
    expect(await searchStudio(studioA, "FV/73/10/2026", "owner")).toEqual([
      expect.objectContaining({ type: "invoice", title: "FV/73/10/2026", href: "/invoices/FV%2F73%2F10%2F2026?env=test" }),
    ]);
    expect((await searchStudio(studioA, "700111222", "worker")).map((result) => result.type)).toEqual(["client"]);
    expect((await searchStudio(studioA, "WA23456", "worker")).map((result) => result.type)).toEqual(["vehicle", "order"]);
  });

  it("never returns another studio's clients, vehicles, orders, or invoices", async () => {
    expect(await searchStudio(studioA, "Beta Finish", "owner")).toEqual([]);
    expect(await searchStudio(studioA, "KR 98765", "owner")).toEqual([]);
    expect(await searchStudio(studioA, "DF-9832", "owner")).toEqual([]);
    expect(await searchStudio(studioA, "FV/74/10/2026", "owner")).toEqual([]);
    expect((await searchStudio(studioB, "KR 98765", "owner")).map((result) => result.type)).toEqual(["vehicle", "order"]);
  });

  it("does not return invoices to workers, even when they query an invoice buyer", async () => {
    expect(await searchStudio(studioA, "Karo Research", "worker")).toEqual([]);
    expect(await searchStudio(studioA, "Karo Research", "owner")).toEqual([
      expect.objectContaining({ type: "invoice", title: "FV/73/10/2026" }),
    ]);
  });

  it("handles an empty or too-short query without searching, and bounds URL input", async () => {
    expect(await searchStudio(studioA, "  ", "owner")).toEqual([]);
    expect(await searchStudio(studioA, "A", "owner")).toEqual([]);
    expect(searchQueryFromUrl("https://detailflow.test/api/search?q=%20%20DF-9831%20%20")).toBe("DF-9831");
    expect(searchQueryFromUrl(`https://detailflow.test/api/search?q=${"x".repeat(120)}`)).toHaveLength(100);
  });
});
