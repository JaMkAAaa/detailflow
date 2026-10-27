import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { DEMO, seed } from "../../../prisma/seed";
import { getClientProfile, listClients } from "./directory";
import { clientsHref, parseClientsQuery, phoneVariants, plateVariants } from "./query";

const query = (params: Parameters<typeof parseClientsQuery>[0] = {}) => parseClientsQuery(params);

describe("client query parsing", () => {
  it("falls back to defaults for junk and keeps the URL minimal", () => {
    expect(query({ filter: "nope", page: "-3", q: ["  Nowak ", "x"] })).toEqual({ q: "Nowak", filter: "all", page: 1, client: null });
    expect(query({ page: "2.5" }).page).toBe(1);
    expect(clientsHref({})).toBe("/customers");
    expect(clientsHref({ q: "Lis", filter: "regular", page: 3, client: "c1" })).toBe("/customers?q=Lis&filter=regular&page=3&client=c1");
    expect(clientsHref({ filter: "all", page: 1 })).toBe("/customers");
  });

  it("matches phones and plates in the stored format", () => {
    expect(phoneVariants("600123")).toEqual(["600123", "600 123"]);
    expect(phoneVariants("+48600123456")).toEqual(["+48600123456", "600 123 456"]);
    expect(phoneVariants("Nowak")).toEqual([]);
    expect(plateVariants("wa911")).toEqual(["wa911", "wa 911"]);
    expect(plateVariants("WPI 3456K")).toEqual(["WPI 3456K"]);
  });
});

describe("client directory (Postgres, seed Obsidian Studio)", () => {
  let studioId: string;
  const now = DEMO.now;

  beforeAll(async () => {
    ({ studioId } = await seed());
  });

  it("returns 20 rows per page, 7 pages for 124 clients and 168 vehicles", async () => {
    const first = await listClients(studioId, query(), now);
    expect(first).toMatchObject({ total: 124, vehicleTotal: 168, pages: 7, page: 1, counts: { all: 124, regular: 79, coating: 3 } });
    expect(first.rows).toHaveLength(20);
    const last = await listClients(studioId, query({ page: "7" }), now);
    expect(last.rows).toHaveLength(4);
    expect((await listClients(studioId, query({ page: "99" }), now)).page).toBe(7);

    const ids = new Set<string>();
    for (let page = 1; page <= 7; page++) {
      for (const row of (await listClients(studioId, query({ page: String(page) }), now)).rows) ids.add(row.id);
    }
    expect(ids.size).toBe(124);
  });

  it("starts with the mockup page: Adam Nowak first, with his totals and last visit", async () => {
    const { rows, selected } = await listClients(studioId, query(), now);
    expect(rows.slice(0, 6).map((r) => r.name)).toEqual(["Adam Nowak", "Anna Wiśniewska", "Piotr Zieliński", "Tomasz Lis", "Ewa Mazur", "Jan Lewandowski"]);
    expect(rows[0]).toMatchObject({ phone: "+48 600 123 456", plates: ["WA 911PC", "WA 492BM"], totalGross: "12350.00" });
    expect(rows[0]!.lastVisit?.toISOString()).toBe("2026-10-24T06:00:00.000Z");
    expect(selected).toMatchObject({ name: "Adam Nowak", isRegular: true, coatingService: true, visitCount: 6 });
  });

  it("builds Adam Nowak's card: cars with the running order and the last visits", async () => {
    const { selected } = await listClients(studioId, query(), now);
    const [porsche, bmw] = selected!.vehicles;
    expect(porsche).toMatchObject({ plate: "WA 911PC", year: 2021, color: "czarny", active: { number: "DF-0248", status: "in_progress" } });
    expect(bmw).toMatchObject({ plate: "WA 492BM", active: null });
    expect(bmw!.lastVisit?.toISOString()).toBe("2026-10-22T06:00:00.000Z");
    expect(selected!.since.toISOString().slice(0, 7)).toBe("2025-03");
    expect(selected!.visits.map((v) => [v.number, v.totalGross])).toEqual([
      ["DF-0248", "4800.00"],
      ["DF-0243", "4800.00"],
      ["DF-0188", "450.00"],
    ]);
  });

  it("filters regular clients and clients with an open coating reminder", async () => {
    const regular = await listClients(studioId, query({ filter: "regular" }), now);
    expect(regular.total).toBe(79);
    expect(regular.pages).toBe(4);
    const coating = await listClients(studioId, query({ filter: "coating" }), now);
    expect(coating.rows.map((r) => r.name)).toEqual(["Adam Nowak", "Anna Wiśniewska", "Piotr Zieliński"]);
    expect(coating.vehicleTotal).toBe(6);
    // Liczniki chipów zostają całostudyjne mimo zawężenia.
    expect(coating.counts).toEqual({ all: 124, regular: 79, coating: 3 });
  });

  it("searches by surname, phone in any format and plate with or without a space", async () => {
    const names = async (q: string, filter = "all") => (await listClients(studioId, query({ q, filter }), now)).rows.map((r) => r.name);
    expect(await names("nowak")).toContain("Adam Nowak");
    expect(await names("600123456")).toEqual(["Adam Nowak"]);
    expect(await names("+48 600 123")).toEqual(["Adam Nowak"]);
    expect(await names("wa911pc")).toEqual(["Adam Nowak"]);
    expect(await names("WA 492BM")).toEqual(["Adam Nowak"]);
    expect(await names("nowak", "coating")).toEqual(["Adam Nowak"]);
    expect(await names("nie-ma-takiego")).toEqual([]);
    // % i _ nie są wildcardami.
    expect(await names("%")).toEqual([]);
    expect(await names("_")).toEqual([]);
    expect(await names("\\")).toEqual([]);
    const none = await listClients(studioId, query({ q: "nie-ma-takiego" }), now);
    expect(none).toMatchObject({ total: 0, rows: [], selected: null, pages: 1 });
  });

  it("sums money as Decimal strings and ignores canceled orders and future bookings in last visit", async () => {
    const db = studioDb(studioId);
    const lis = await db.client.findFirstOrThrow({ where: { name: "Tomasz Lis" } });
    const row = (await listClients(studioId, query({ q: "Tomasz Lis" }), now)).rows[0]!;
    expect(row.totalGross).toBe("1200.00");
    const future = await listClients(studioId, query({ q: "Ewa Mazur" }), now);
    // DF-0252 (25.10) jeszcze się nie zaczęło; ostatnia wizyta to DF-0226.
    expect(future.rows[0]!.lastVisit?.toISOString().slice(0, 10)).toBe("2026-10-07");
    expect(future.rows[0]!.totalGross).toBe("3050.00");
    expect((await getClientProfile(studioId, lis.id, now))!.visitCount).toBe(1);
  });
});

describe("client directory tenant isolation (Postgres)", () => {
  const tag = randomUUID();
  let a: string;
  let b: string;
  let foreignClient: string;

  beforeAll(async () => {
    const studios = await Promise.all(
      ["a", "b"].map((s) => platformDb.studio.create({ data: { publicCode: `${tag}-${s}`, slug: `${tag}-${s}`, name: `Klienci ${s}`, ksefEnv: "test" } })),
    );
    [a, b] = studios.map((s) => s.id) as [string, string];
    await Promise.all(
      [a, b].map(async (studioId, studioIndex) => {
        const db = studioDb(studioId);
        const clients = await db.client.createManyAndReturn({
          data: Array.from({ length: 25 }, (_, i) => ({
            studioId,
            name: `${studioIndex === 0 ? "Alfa" : "Beta"} ${String(i).padStart(2, "0")}`,
            phone: `+48 700 ${studioIndex}${String(i).padStart(2, "0")} 000`,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
          })),
        });
        await db.vehicle.createMany({ data: clients.map((c, i) => ({ studioId, clientId: c.id, make: "Audi", model: "A4", plate: `${studioIndex ? "ZB" : "ZA"} ${100 + i}` })) });
        if (studioIndex === 1) foreignClient = clients[0]!.id;
      }),
    );
  });

  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: [a, b] } } });
  });

  it("page 2 contains only the scoped studio's clients", async () => {
    const page2 = await listClients(a, query({ page: "2" }));
    expect(page2.total).toBe(25);
    expect(page2.rows).toHaveLength(5);
    expect(page2.rows.every((r) => r.name.startsWith("Alfa"))).toBe(true);
    expect(page2.vehicleTotal).toBe(25);
    const other = await listClients(b, query({ page: "2" }));
    expect(other.rows.every((r) => r.name.startsWith("Beta"))).toBe(true);
    expect(page2.counts).toEqual({ all: 25, regular: 0, coating: 0 });
  });

  it("searching by another studio's phone or plate finds nothing", async () => {
    expect((await listClients(a, query({ q: "+48 700 100" }))).total).toBe(0);
    expect((await listClients(a, query({ q: "ZB 100" }))).total).toBe(0);
    expect((await listClients(b, query({ q: "ZB 100" }))).total).toBe(1);
  });

  it("a foreign ?client= falls back to the first own client and never leaks", async () => {
    const { selected, rows } = await listClients(a, query({ client: foreignClient }));
    expect(selected?.id).toBe(rows[0]!.id);
    expect(selected?.name.startsWith("Alfa")).toBe(true);
    expect(await getClientProfile(a, foreignClient)).toBeNull();
    expect((await getClientProfile(b, foreignClient))?.name).toBe("Beta 00");
  });
});
