import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "./client";
import { scopeArgs, studioDb, TenantScopeError } from "./tenant";

describe("studioDb — guard", () => {
  it("rejects a missing or empty studioId", () => {
    expect(() => studioDb("")).toThrow(TenantScopeError);
    expect(() => studioDb("   ")).toThrow(TenantScopeError);
    expect(() => studioDb(undefined as unknown as string)).toThrow(TenantScopeError);

    // @ts-expect-error — studioDb bez studioId nie kompiluje się.
    expect(() => studioDb()).toThrow(TenantScopeError);
  });

  it("does not expose platform models or raw SQL", () => {
    const db = studioDb("studio-a");
    // @ts-expect-error — model platformy niedostępny na poziomie typów.
    expect(() => db.user).toThrow(TenantScopeError);
    // @ts-expect-error
    expect(() => db.studio).toThrow(TenantScopeError);
    // @ts-expect-error
    expect(() => db.$queryRawUnsafe).toThrow(TenantScopeError);
  });

  it("injects studioId into where and data", () => {
    expect(scopeArgs("Client", "findMany", {}, "a")).toEqual({ where: { studioId: "a" } });
    expect(scopeArgs("Client", "findUnique", { where: { id: "x" } }, "a")).toEqual({ where: { id: "x", studioId: "a" } });
    expect(scopeArgs("Client", "create", { data: { name: "X" } }, "a")).toEqual({ data: { name: "X", studioId: "a" } });
    expect(scopeArgs("Bay", "createMany", { data: [{ name: "B", sort: 1 }] }, "a")).toEqual({
      data: [{ name: "B", sort: 1, studioId: "a" }],
    });
  });

  it("rejects a mismatched studioId, moving records and unknown operations", () => {
    expect(() => scopeArgs("Client", "findMany", { where: { studioId: "b" } }, "a")).toThrow(TenantScopeError);
    expect(() => scopeArgs("Client", "create", { data: { studioId: "b" } }, "a")).toThrow(TenantScopeError);
    expect(() => scopeArgs("Client", "create", { data: { studio: { connect: { id: "b" } } } }, "a")).toThrow(TenantScopeError);
    expect(() => scopeArgs("Client", "updateMany", { where: {}, data: { studioId: "b" } }, "a")).toThrow(TenantScopeError);
    expect(() => scopeArgs("Client", "somethingNew", {}, "a")).toThrow(TenantScopeError);
    expect(() => scopeArgs("User", "findMany", {}, "a")).toThrow(TenantScopeError);
  });
});

describe("studioDb — tenant isolation (Postgres)", () => {
  const tag = randomUUID().slice(0, 8);
  let a: string;
  let b: string;
  let clientB: string;
  let vehicleB: string;

  beforeAll(async () => {
    const [sa, sb] = await Promise.all(
      ["a", "b"].map((x) =>
        platformDb.studio.create({ data: { publicCode: `T-${tag}-${x}`, name: `Test ${x}`, slug: `test-${tag}-${x}` } }),
      ),
    );
    a = sa!.id;
    b = sb!.id;
    await studioDb(a).client.create({ data: { studioId: a, name: "Klient A" } });
    const cb = await studioDb(b).client.create({ data: { studioId: b, name: "Klient B" } });
    clientB = cb.id;
    const vb = await studioDb(b).vehicle.create({
      data: { studioId: b, clientId: clientB, make: "Fiat", model: "Panda", plate: `T ${tag}` },
    });
    vehicleB = vb.id;
  });

  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { slug: { startsWith: `test-${tag}` } } });
  });

  it("reads only the scoped studio", async () => {
    const names = (await studioDb(a).client.findMany()).map((c) => c.name);
    expect(names).toEqual(["Klient A"]);
    expect(await studioDb(a).client.count()).toBe(1);
    expect(await studioDb(a).client.findUnique({ where: { id: clientB } })).toBeNull();
    expect(await studioDb(a).client.findFirst({ where: { name: "Klient B" } })).toBeNull();
  });

  it("cannot update or delete another studio's rows", async () => {
    await expect(studioDb(a).client.update({ where: { id: clientB }, data: { name: "hacked" } })).rejects.toThrow();
    expect((await studioDb(a).client.updateMany({ where: { id: clientB }, data: { name: "hacked" } })).count).toBe(0);
    expect((await studioDb(a).client.deleteMany({})).count).toBe(1);
    expect(await studioDb(b).client.findUnique({ where: { id: clientB } })).toMatchObject({ name: "Klient B" });
  });

  it("cannot write into another studio", async () => {
    await expect(studioDb(a).client.create({ data: { studioId: b, name: "X" } })).rejects.toThrow(TenantScopeError);
  });

  it("composite FKs block cross-tenant links even without the helper", async () => {
    const client = await studioDb(a).client.create({ data: { studioId: a, name: "Klient A2" } });
    // Auto studia B podpięte pod zlecenie studia A — baza odrzuca (FK (vehicleId, studioId)).
    await expect(
      platformDb.workOrder.create({
        data: {
          studioId: a,
          number: `DF-${tag}`,
          clientId: client.id,
          vehicleId: vehicleB,
          status: "accepted",
          service: "Test",
          scheduledFrom: new Date(),
          scheduledTo: new Date(),
          totalGross: "100.00",
        },
      }),
    ).rejects.toThrow();
  });

  it("nested creates inherit studioId from the parent", async () => {
    const db = studioDb(b);
    const quote = await db.quote.create({
      data: {
        studioId: b,
        clientId: clientB,
        vehicleId: vehicleB,
        status: "draft",
        sizeMult: "1.00",
        paintMult: "1.00",
        totalGross: "100.00",
        vatAmount: "18.70",
        items: { create: [{ name: "Mycie", basePrice: "100.00", sort: 1 }] },
      },
      include: { items: true },
    });
    expect(quote.items[0]?.studioId).toBe(b);
  });
});
