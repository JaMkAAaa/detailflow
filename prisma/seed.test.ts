// Kontrakt danych demo: file-structure.md → „Reguły danych demonstracyjnych”
// oraz docs/dokumentacja-wdrozenia.md §5.2 i §15.
import { beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../lib/db/client";
import { Prisma } from "../lib/db/generated/client";
import { studioDb, type StudioDb } from "../lib/db/tenant";
import { hashPortalToken } from "../lib/portal/token";
import { DEMO, seed } from "./seed";
import { getDashboardMetrics } from "../src/server/pulpit/metrics";

const sum = (rows: { totalGross: Prisma.Decimal }[]) => rows.reduce((s, r) => s.plus(r.totalGross), new Prisma.Decimal(0));

describe("seed Obsidian Studio", () => {
  let db: StudioDb;

  beforeAll(async () => {
    // Dwa przebiegi pod rząd: reset musi być czysty, bez konfliktów unikalności.
    await seed();
    const { studioId } = await seed();
    db = studioDb(studioId);
  });

  it("is a single demo studio owned by Michał Kowalski", async () => {
    const studios = await platformDb.studio.findMany({ where: { slug: DEMO.studioSlug }, include: { members: { include: { user: true } } } });
    expect(studios).toHaveLength(1);
    expect(studios[0]).toMatchObject({ name: "Obsidian Studio", city: "Warszawa", ksefEnv: "test" });
    expect(studios[0]!.members.map((m) => [m.user.name, m.role])).toEqual([["Michał Kowalski", "owner"]]);
    expect(await db.bay.findMany({ orderBy: { sort: "asc" }, select: { name: true } })).toEqual([{ name: "Boks 01" }, { name: "Boks 02" }]);
  });

  it("has 7 active orders: 3 in progress, 2 ready for pickup, 2 accepted", async () => {
    const active = await db.workOrder.findMany({ where: { status: { in: ["accepted", "in_progress", "ready_for_pickup"] } } });
    expect(active).toHaveLength(7);
    const by = (s: string) => active.filter((o) => o.status === s).length;
    expect([by("in_progress"), by("ready_for_pickup"), by("accepted")]).toEqual([3, 2, 2]);
  });

  it("#DF-0248 is the Porsche of Adam Nowak, in progress, stage 2 of 4, Boks 01", async () => {
    const o = await db.workOrder.findFirstOrThrow({
      where: { number: "DF-0248" },
      include: { client: true, vehicle: true, bay: true, quote: { include: { items: true } }, invoices: true },
    });
    expect(o).toMatchObject({ status: "in_progress", stage: 2, completedAt: null });
    expect(o.client.name).toBe("Adam Nowak");
    expect([o.vehicle.make, o.vehicle.model, o.vehicle.plate]).toEqual(["Porsche", "Panamera", "WA 911PC"]);
    expect(o.bay?.name).toBe("Boks 01");
    expect(o.totalGross.toFixed(2)).toBe("4800.00");
    // §5.3: 4 000 × 1,20 × 1,00 = 4 800,00; VAT 897,56.
    const base = o.quote!.items.reduce((s, i) => s.plus(i.basePrice), new Prisma.Decimal(0));
    expect(base.times(o.quote!.sizeMult).times(o.quote!.paintMult).toFixed(2)).toBe("4800.00");
    expect(o.quote!.vatAmount.toFixed(2)).toBe("897.56");
    expect(o.invoices).toHaveLength(0);
  });

  it("FV/41/10/2026 comes from completed #DF-0243 (23.10.2026), not #DF-0248", async () => {
    const fv = await db.invoice.findFirstOrThrow({
      where: { number: "FV/41/10/2026", ksefEnv: "test" },
      include: { workOrder: true, events: { orderBy: { at: "asc" } } },
    });
    expect(fv.workOrder.number).toBe("DF-0243");
    expect(fv.workOrder.status).toBe("completed");
    expect(fv.workOrder.completedAt?.toISOString().slice(0, 10)).toBe("2026-10-23");
    expect(fv.buyerName).toBe("Adam Nowak");
    expect([fv.totalNet, fv.totalVat, fv.totalGross].map((d) => d.toFixed(2))).toEqual(["3902.44", "897.56", "4800.00"]);
    expect(fv.ksefNumber).toBe("9512345678-20261024-8F3A21C4B7E0-5D");
    // 24.10, 10:12:08 → 10:13:08 (czas lokalny, CEST), 60 s.
    expect(fv.issuedAt?.toISOString()).toBe("2026-10-24T08:12:08.000Z");
    expect(fv.ksefAcceptedAt?.toISOString()).toBe("2026-10-24T08:13:08.000Z");
    expect((fv.ksefAcceptedAt!.getTime() - fv.issuedAt!.getTime()) / 1000).toBe(60);
    expect(fv.events.at(-1)?.kind).toBe("accepted");
  });

  it("issues invoices only for completed orders", async () => {
    const invoices = await db.invoice.findMany({ include: { workOrder: true } });
    expect(invoices.length).toBeGreaterThan(0);
    for (const inv of invoices) {
      expect(inv.workOrder.status).toBe("completed");
      expect(inv.issuedAt!.getTime()).toBeGreaterThanOrEqual(inv.workOrder.completedAt!.getTime());
    }
  });

  it("overdue is 3 450 zł in 2 invoices; all unpaid is 8 250 zł including FV/41", async () => {
    const unpaid = await db.invoice.findMany({ where: { status: "issued", ksefStatus: "accepted", paidAt: null } });
    expect(sum(unpaid).toFixed(2)).toBe("8250.00");
    expect(unpaid.map((i) => i.number)).toContain("FV/41/10/2026");
    const overdue = unpaid.filter((i) => i.dueAt! < DEMO.now);
    expect(overdue).toHaveLength(2);
    expect(sum(overdue).toFixed(2)).toBe("3450.00");
  });

  it("stores money as Decimal", async () => {
    const fv = await db.invoice.findFirstOrThrow({ where: { number: "FV/41/10/2026" }, include: { items: true } });
    expect(fv.totalGross).toBeInstanceOf(Prisma.Decimal);
    expect(fv.items.map((i) => i.net.toFixed(2))).toEqual(["1951.22", "1951.22"]);
  });

  it("has 124 clients (79 regular) and 168 vehicles; page 1 starts with Adam Nowak", async () => {
    expect(await db.client.count()).toBe(124);
    expect(await db.client.count({ where: { isRegular: true } })).toBe(79);
    expect(await db.vehicle.count()).toBe(168);
    const nowak = await db.client.findFirstOrThrow({ where: { name: "Adam Nowak" }, include: { vehicles: true } });
    expect(nowak.vehicles.map((v) => v.plate).sort()).toEqual(["WA 492BM", "WA 911PC"]);
  });

  it("feeds live dashboard metrics and three coating clients from the demo seed", async () => {
    const studio = await platformDb.studio.findUniqueOrThrow({ where: { slug: DEMO.studioSlug } });
    const metrics = await getDashboardMetrics(studio.id, DEMO.now);
    expect(metrics.active).toEqual({ total: 7, inProgress: 3, ready: 2, accepted: 2 });
    expect(metrics.returning).toEqual({ percent: 64, regular: 79, total: 124 });
    expect(metrics.featured).toMatchObject({ number: "DF-0248", stage: 2, vehicle: "Porsche Panamera" });
    expect(metrics.alerts.coatingClients).toBe(3);
    expect(metrics.alerts.rejected.map((i) => i.number)).toContain("FV/39/10/2026");
  });

  it("stores only the portal token hash", async () => {
    const link = await db.portalLink.findFirstOrThrow({ where: { tokenHash: hashPortalToken(DEMO.portalToken) }, include: { workOrder: true } });
    expect(link.workOrder.number).toBe("DF-0248");
    expect(link.tokenHash).not.toBe(DEMO.portalToken);
    expect(await db.portalLink.count({ where: { expiresAt: { lt: DEMO.now } } })).toBe(1);
  });
});
