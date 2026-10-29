import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { authorizeStudio } from "../acl";
import { saveQuote } from "./send";
import { loadQuoteWizard } from "./query";
import { createService, deleteService, listServices, seedServices, updateService } from "./catalog";
import { loadOrderChoices } from "../zlecenia/orders";
import { GET, POST } from "@/app/api/studios/[studioId]/services/route";
import { DELETE, PATCH } from "@/app/api/studios/[studioId]/services/[serviceId]/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

const tag = randomUUID();
const users: Record<string, { id: string }> = {};
const studios: string[] = [];

function request(method: string, studioId: string, body?: unknown, serviceId?: string) {
  const path = serviceId ? `/api/studios/${studioId}/services/${serviceId}` : `/api/studios/${studioId}/services`;
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const listContext = (studioId: string) => ({ params: Promise.resolve({ studioId }) });
const itemContext = (studioId: string, serviceId: string) => ({ params: Promise.resolve({ studioId, serviceId }) });

beforeAll(async () => {
  for (const role of ["owner", "manager", "worker"] as const) {
    users[role] = await platformDb.user.create({ data: { email: `${tag}-${role}@example.test`, name: role } });
  }
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({
      data: { status: "active", name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}` },
    });
    studios.push(studio.id);
  }
  const db = studioDb(studios[0]!);
  for (const role of ["owner", "manager", "worker"] as const) {
    await db.membership.create({ data: { studioId: studios[0]!, userId: users[role]!.id, role } });
  }
  await studioDb(studios[1]!).membership.create({ data: { studioId: studios[1]!, userId: users.owner!.id, role: "owner" } });
});

afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("service catalog CMS (Postgres)", () => {
  it("lets owner and manager manage services and refuses the worker", async () => {
    for (const role of ["owner", "manager"] as const) {
      await expect(authorizeStudio(users[role]!.id, studios[0]!, "services:manage")).resolves.toBeDefined();
    }
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "services:manage")).rejects.toMatchObject({ status: 403 });
    mocks.session.mockResolvedValue(null);
    expect((await GET(request("GET", studios[0]!), listContext(studios[0]!))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: users.worker });
    expect((await GET(request("GET", studios[0]!), listContext(studios[0]!))).status).toBe(403);
    expect((await POST(request("POST", studios[0]!, { name: "Mycie", basePrice: "10.00", durationMin: 30 }), listContext(studios[0]!))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.manager });
    expect((await GET(request("GET", studios[1]!), listContext(studios[1]!))).status).toBe(403);
  });

  it("stores Decimal prices, rejects floats and keeps tenants apart", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const created = await POST(request("POST", studios[0]!, { name: "Korekta", basePrice: "10.5", durationMin: 40 }), listContext(studios[0]!));
    expect(created.status).toBe(201);
    const service = await created.json();
    expect(service.basePrice).toBe("10.50");
    expect(typeof service.basePrice).toBe("string");
    const other = await createService(studios[1]!, { name: "Tylko B", basePrice: "15.00", durationMin: 20 });
    const own = await listServices(studios[0]!);
    const foreign = await listServices(studios[1]!);
    expect(own.map((item) => item.name)).toContain("Korekta");
    expect(own.map((item) => item.id)).not.toContain(other.id);
    expect(foreign.map((item) => item.id)).toEqual([other.id]);
    const rejected = [
      { name: "Zła", basePrice: 10, durationMin: 30 },
      { name: "Zła", basePrice: "10.555", durationMin: 30 },
      { name: "Zła", basePrice: "1e2", durationMin: 30 },
      { name: "Zła", basePrice: "-1.00", durationMin: 30 },
      { name: "", basePrice: "10.00", durationMin: 30 },
      { name: "Zła", basePrice: "10.00", durationMin: 1.5 },
      { name: "Zła", basePrice: "10.00", durationMin: 60001 },
      { name: "Zła", basePrice: "10.00", durationMin: -1 },
    ];
    for (const body of rejected) {
      expect((await POST(request("POST", studios[0]!, body), listContext(studios[0]!))).status).toBe(400);
    }
    const missing = await PATCH(request("PATCH", studios[0]!, { name: "Brak" }, "missing"), itemContext(studios[0]!, "missing"));
    const cross = await PATCH(request("PATCH", studios[0]!, { basePrice: "1.00" }, other.id), itemContext(studios[0]!, other.id));
    expect(missing.status).toBe(404);
    expect(cross.status).toBe(404);
    expect(await missing.json()).toEqual(await cross.json());
    expect((await listServices(studios[1]!)).map((item) => item.basePrice)).toEqual(["15.00"]);
    const blocked = await POST(request("POST", studios[0]!, { name: "Obce źródło", basePrice: "10.00", durationMin: 10 }), listContext(studios[0]!));
    expect((await POST(new Request(`http://localhost:3000/api/studios/${studios[0]}/services`, {
      method: "POST",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      body: JSON.stringify({ name: "Obce źródło", basePrice: "10.00", durationMin: 10 }),
    }), listContext(studios[0]!))).status).toBe(403);
    expect(blocked.status).toBe(201);
  });

  it("hides services from new choices, deletes them for good and leaves quote snapshots", async () => {
    const studioId = studios[0]!;
    const db = studioDb(studioId);
    const client = await db.client.create({ data: { studioId, name: "Adam" } });
    const vehicle = await db.vehicle.create({ data: { studioId, clientId: client.id, make: "Porsche", model: "Panamera", plate: tag } });
    const service = await createService(studioId, { name: "Powłoka", description: "3 lata", basePrice: "2000.00", durationMin: 200 });
    const quoteId = randomUUID();
    await saveQuote(studioId, quoteId, {
      clientId: client.id, vehicleId: vehicle.id, size: "medium", paintMult: "1.00", notes: "",
      items: [{ name: "Powłoka", basePrice: "2000.00", durationMin: 200 }],
    }, users.owner!.id);
    await db.quoteItem.updateMany({ where: { quoteId }, data: { serviceId: service.id } });
    const before = await db.quoteItem.findMany({ where: { quoteId } });

    const hidden = await updateService(studioId, service.id, { active: false });
    expect(hidden.active).toBe(false);
    const wizard = await loadQuoteWizard(studioId, users.owner!.id);
    expect(wizard.services.map((item) => item.id)).not.toContain(service.id);
    expect(wizard.heldServices.map((item) => item.id)).toContain(service.id);
    expect((await loadOrderChoices(studioId)).services.map((item) => item.id)).not.toContain(service.id);
    expect((await listServices(studioId)).find((item) => item.id === service.id)?.active).toBe(false);

    await updateService(studioId, service.id, { basePrice: "1.00", name: "Inna nazwa" });
    await deleteService(studioId, service.id);
    const after = await db.quoteItem.findMany({ where: { quoteId } });
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({
      serviceId: before[0]!.serviceId,
      name: "Powłoka",
      durationMin: 200,
    });
    expect(after[0]!.basePrice.toFixed(2)).toBe("2000.00");
    const held = await loadQuoteWizard(studioId, users.owner!.id);
    expect(held.services.map((item) => item.id)).not.toContain(service.id);
    expect(held.heldServices.find((item) => item.id === service.id)).toMatchObject({ name: "Powłoka", price: "2000.00", inCatalog: false });

    await seedServices(studios[1]!);
    await studioDb(studios[1]!).service.deleteMany({});
    await loadQuoteWizard(studios[1]!, users.owner!.id);
    await loadOrderChoices(studios[1]!);
    expect(await studioDb(studios[1]!).service.count()).toBe(0);
    expect((await loadQuoteWizard(studios[1]!, users.owner!.id)).services).toEqual([]);
    expect((await loadOrderChoices(studios[1]!)).services).toEqual([]);
  });

  it("blocks catalog writes when billing is read-only and allows the read", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    await platformDb.studio.update({ where: { id: studios[0] }, data: { status: "past_due" } });
    try {
      const denied = await POST(request("POST", studios[0]!, { name: "Zaległość", basePrice: "10.00", durationMin: 15 }), listContext(studios[0]!));
      expect(denied.status).toBe(403);
      expect((await GET(request("GET", studios[0]!), listContext(studios[0]!))).status).toBe(200);
    } finally {
      await platformDb.studio.update({ where: { id: studios[0] }, data: { status: "active" } });
    }
  });

  it("returns the same 404 when deleting a foreign or missing service", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const foreign = await createService(studios[1]!, { name: "Cudza", basePrice: "9.00", durationMin: 10 });
    const missing = await DELETE(request("DELETE", studios[0]!, undefined, "missing"), itemContext(studios[0]!, "missing"));
    const cross = await DELETE(request("DELETE", studios[0]!, undefined, foreign.id), itemContext(studios[0]!, foreign.id));
    expect(missing.status).toBe(404);
    expect(cross.status).toBe(404);
    expect(await missing.json()).toEqual(await cross.json());
    expect(await studioDb(studios[1]!).service.count({ where: { id: foreign.id } })).toBe(1);
    const removed = await DELETE(request("DELETE", studios[1]!, undefined, foreign.id), itemContext(studios[1]!, foreign.id));
    expect(removed.status).toBe(204);
  });
});
