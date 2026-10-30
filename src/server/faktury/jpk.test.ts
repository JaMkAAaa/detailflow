import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceFixture } from "@/src/invoices/fixtures/document";
import { exportJpk } from "./jpk";

import { POST } from "@/app/api/studios/[studioId]/invoices/jpk/route";
const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/src/server/rate-limit", () => ({ API_WRITE_RULE: {}, counterKey: () => "test", sharedCounter: () => ({ consume: async () => ({ allowed: true }) }) }));
const options = { from: "2026-10-01", to: "2026-10-31", env: "test", office: "1471", province: "mazowieckie", county: "Warszawa", municipality: "Warszawa", street: "Rzemieślnicza", building: "12", apartment: "" };
const tag = randomUUID();
let a: string, b: string;
const users: { id: string; role: string }[] = [];
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix, nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa" } })));
  a = studios[0]!.id; b = studios[1]!.id;
  for (const role of ["owner", "manager", "worker"] as const) {
    const user = await platformDb.user.create({ data: { email: `${tag}-${role}@example.com`, name: role } });
    users.push({ id: user.id, role });
    await studioDb(b).membership.create({ data: { studioId: b, userId: user.id, role } });
  }
  await platformDb.studio.updateMany({ where: { id: { in: [a, b] } }, data: { status: "active" } });
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Buyer" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "BMW", model: "X3", plate: tag } });
  const fixture = invoiceFixture();
  const order = await db.workOrder.create({ data: { studioId: b, clientId: client.id, vehicleId: vehicle.id, number: "DF-0243", service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), ...fixture.order } });
  for (const [number, env, status, at] of [
    ["TEST-INCLUDED", "test", "issued", "2026-09-30T22:00:00Z"],
    ["PROD-ONLY", "production", "issued", "2026-10-31T22:59:59Z"],
    ["DRAFT-EXCLUDED", "test", "draft", "2026-10-12T12:00:00Z"],
    ["BEFORE-EXCLUDED", "test", "issued", "2026-09-30T21:59:59Z"],
    ["AFTER-EXCLUDED", "test", "issued", "2026-10-31T23:00:00Z"],
  ] as const) {
    const invoice = { ...fixture.invoice, id: undefined, studioId: undefined, items: undefined };
    await db.invoice.create({ data: { ...invoice, studioId: b, number, status, issuedAt: new Date(at), workOrderId: order.id, buyerName: number, ksefEnv: env, ksefNumber: null,
      items: { create: fixture.invoice.items.map(line => ({ ...line, id: undefined, studioId: undefined, invoiceId: undefined })) },
    } });
  }
});
afterAll(async () => { await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } }); await platformDb.user.deleteMany({ where: { id: { in: users.map(u => u.id) } } }); });
it("isolates two tenants, TEST/PROD, drafts and Warsaw issue date boundaries", async () => {
  await expect(exportJpk(a, options)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Brak wystawionych") });
  const test = await exportJpk(b, options);
  expect(test.xml).toContain("TEST-INCLUDED");
  for (const value of ["PROD-ONLY", "DRAFT-EXCLUDED", "BEFORE-EXCLUDED", "AFTER-EXCLUDED"]) expect(test.xml).not.toContain(value);
  const prod = await exportJpk(b, { ...options, env: "production" });
  expect(prod.xml).toContain("PROD-ONLY"); expect(prod.xml).not.toContain("TEST-INCLUDED");
  expect(prod.filename).toBe("JPK_FA-4-2026-10-01-2026-10-31-production.xml");
});
it("rejects missing/invalid environment, invalid dates, reversed and excessive periods", async () => {
  for (const changes of [{ env: "all" }, { env: undefined }, { from: "2026-02-30" }, { from: "2026-11-01" }, { from: "2024-01-01" }])
    await expect(exportJpk(b, { ...options, ...changes })).rejects.toThrow();
});

const post = (studioId: string, origin = "http://localhost:3000") => POST(new Request(`http://localhost:3000/api/studios/${studioId}/invoices/jpk`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(options) }), { params: Promise.resolve({ studioId }) });
it("requires login, own-studio owner/manager permission and same origin; returns an XML attachment", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await post(b)).status).toBe(401);
  for (const user of users) {
    mocks.session.mockResolvedValue({ user });
    expect((await post(a)).status).toBe(403);
    const response = await post(b);
    expect(response.status).toBe(user.role === "worker" ? 403 : 200);
    if (response.status === 200) {
      expect(response.headers.get("Content-Type")).toContain("application/xml");
      expect(response.headers.get("Content-Disposition")).toContain("attachment;");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(await response.text()).toContain("TEST-INCLUDED");
    }
  }
  expect((await post(b, "https://foreign.example")).status).toBe(403);
});
