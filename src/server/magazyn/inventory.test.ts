import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { getDashboardMetrics } from "../pulpit/metrics";
import { createChemical, correctChemical, listChemicals } from "./inventory";
import { GET, POST } from "@/app/api/studios/[studioId]/inventory/route";
import { PATCH } from "@/app/api/studios/[studioId]/inventory/[chemicalId]/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID();
const studios: string[] = [];
const users: Record<string, { id: string }> = {};
const input = { name: "Pasta", unit: "ml", quantity: 100, lowThreshold: 20, reason: "Inwentaryzacja" };
const correction = { quantity: 0, lowThreshold: 20, version: 0, reason: "Pomiar stanu" };
function req(method: string, body?: unknown, origin: string | null = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/studios/unused/inventory", {
    method, headers: { ...(origin ? { origin } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = (studioId: string) => ({ params: Promise.resolve({ studioId }) });
const itemCtx = (studioId: string, chemicalId: string) => ({ params: Promise.resolve({ studioId, chemicalId }) });
beforeAll(async () => {
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, status: "active" } });
    studios.push(studio.id);
  }
  for (const role of ["owner", "manager", "worker"] as const) {
    users[role] = await platformDb.user.create({ data: { name: role, email: `${tag}-${role}@example.test` } });
    await studioDb(studios[0]!).membership.create({ data: { studioId: studios[0]!, userId: users[role]!.id, role } });
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});
it("requires session and membership, lets workers read and only managers/owners write", async () => {
  const context = ctx(studios[0]!);
  mocks.session.mockResolvedValue(null);
  expect((await GET(req("GET"), context)).status).toBe(401);
  mocks.session.mockResolvedValue({ user: users.worker });
  expect((await GET(req("GET"), context)).status).toBe(200);
  expect((await POST(req("POST", input), context)).status).toBe(403);
  expect((await PATCH(req("PATCH", correction), itemCtx(studios[0]!, "missing"))).status).toBe(403);
  expect((await GET(req("GET"), ctx(studios[1]!))).status).toBe(403);
  for (const role of ["owner", "manager"]) {
    mocks.session.mockResolvedValue({ user: users[role] });
    expect((await POST(req("POST", input), context)).status).toBe(201);
  }
});
it("rejects missing/foreign Origin, malformed JSON and invalid integer quantities", async () => {
  mocks.session.mockResolvedValue({ user: users.owner });
  for (const origin of [null, "https://evil.example"]) {
    expect((await POST(req("POST", input, origin), ctx(studios[0]!))).status).toBe(403);
    expect((await PATCH(req("PATCH", correction, origin), itemCtx(studios[0]!, "missing"))).status).toBe(403);
  }
  expect((await POST(new Request("http://localhost:3000", { method: "POST", headers: { origin: "http://localhost:3000" }, body: "{" }), ctx(studios[0]!))).status).toBe(400);
  for (const value of [-1, 0.1, 2_000_000_001, "10", 1e40, null]) {
    expect((await POST(req("POST", { ...input, quantity: value }), ctx(studios[0]!))).status).toBe(400);
    expect((await PATCH(req("PATCH", { ...correction, lowThreshold: value }), itemCtx(studios[0]!, "missing"))).status).toBe(400);
  }
  for (const data of [{ ...input, name: " " }, { ...input, reason: " " }, { ...input, unit: "l" }, { ...input, studioId: studios[1] }]) {
    expect((await POST(req("POST", data), ctx(studios[0]!))).status).toBe(400);
  }
  await expect(correctChemical(studios[0]!, "missing", { ...correction, version: -1 })).rejects.toThrow();
});
it("keeps records and threshold alerts isolated, includes exact threshold and zero, clears recovered stock", async () => {
  const a = studios[0]!, b = studios[1]!;
  const own = await createChemical(a, { ...input, quantity: 20 });
  const empty = await createChemical(a, { ...input, name: "Pusta", unit: "piece", quantity: 0, lowThreshold: 0 });
  const foreign = await createChemical(b, { ...input, name: "Tylko B", quantity: 0 });
  expect((await listChemicals(a)).map(row => row.id)).not.toContain(foreign.id);
  expect((await listChemicals(b)).map(row => row.id)).toEqual([foreign.id]);
  expect((await getDashboardMetrics(a)).alerts.chemicals.map(row => row.id).sort()).toEqual([own.id, empty.id].sort());
  expect((await getDashboardMetrics(b)).alerts.chemicals.map(row => row.id)).toEqual([foreign.id]);
  mocks.session.mockResolvedValue({ user: users.owner });
  const missing = await PATCH(req("PATCH", correction), itemCtx(a, "missing"));
  const other = await PATCH(req("PATCH", correction), itemCtx(a, foreign.id));
  expect(missing.status).toBe(404); expect(other.status).toBe(404);
  expect(await other.json()).toEqual(await missing.json());
  await correctChemical(a, own.id, { ...correction, quantity: 21 });
  expect((await getDashboardMetrics(a)).alerts.chemicals.map(row => row.id)).toEqual([empty.id]);
  expect((await listChemicals(b))[0]).toMatchObject({ quantity: 0, version: 0 });
});
it("allows one concurrent correction per version and rejects stale retries with 409", async () => {
  const a = studios[0]!;
  const item = await createChemical(a, { ...input, quantity: 2_000_000_000 });
  const results = await Promise.allSettled([0, 123].map(quantity => correctChemical(a, item.id, { ...correction, quantity })));
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
  const rejected = results.find(result => result.status === "rejected");
  expect(rejected).toMatchObject({ status: "rejected", reason: { status: 409 } });
  const stored = (await listChemicals(a)).find(row => row.id === item.id)!;
  expect(stored.version).toBe(1);
  expect(stored.quantity).toBe((results.find(result => result.status === "fulfilled") as PromiseFulfilledResult<typeof stored>).value.quantity);
  mocks.session.mockResolvedValue({ user: users.owner });
  expect((await PATCH(req("PATCH", correction), itemCtx(a, item.id))).status).toBe(409);
  expect((await listChemicals(a)).find(row => row.id === item.id)).toEqual(stored);
  await expect(studioDb(a).chemical.updateMany({ where: { id: item.id }, data: { quantity: -1 } })).rejects.toThrow();
});
it("preserves read access and denies all writes under billing restrictions", async () => {
  mocks.session.mockResolvedValue({ user: users.owner });
  const a = studios[0]!;
  const item = await createChemical(a, input);
  for (const data of [
    { status: "past_due" as const }, { status: "suspended" as const }, { status: "canceled" as const },
    { status: "trial" as const, trialEndsAt: new Date(0) },
  ]) {
    await platformDb.studio.update({ where: { id: a }, data });
    expect((await GET(req("GET"), ctx(a))).status).toBe(200);
    expect((await POST(req("POST", input), ctx(a))).status).toBe(403);
    expect((await PATCH(req("PATCH", correction), itemCtx(a, item.id))).status).toBe(403);
  }
  await platformDb.studio.update({ where: { id: a }, data: { status: "trial", trialEndsAt: new Date(Date.now() + 86_400_000) } });
  expect((await PATCH(req("PATCH", correction), itemCtx(a, item.id))).status).toBe(200);
  await platformDb.studio.update({ where: { id: a }, data: { status: "active" } });
});
