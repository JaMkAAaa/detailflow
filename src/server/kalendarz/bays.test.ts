import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { createBay } from "./bays";
import { POST } from "../../../app/api/studios/[studioId]/bays/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

describe("bay plan limits (Postgres)", () => {
  const tag = randomUUID(), studios: string[] = [];
  let userId: string;
  const context = (studioId: string) => ({ params: Promise.resolve({ studioId }) });
  const request = (data: unknown = { name: "Boks" }, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/studios/bays", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data),
  });
  beforeAll(async () => {
    userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
    for (const plan of ["solo", "pro", "studio", "solo"] as const) {
      const studio = await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${studios.length}`, publicCode: `${tag}-${studios.length}`, status: "active", plan } });
      studios.push(studio.id);
      await studioDb(studio.id).membership.create({ data: { studioId: studio.id, userId, role: "owner" } });
    }
    mocks.session.mockResolvedValue({ user: { id: userId } });
  });
  afterAll(async () => {
    await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
    if (userId) await platformDb.user.delete({ where: { id: userId } });
  });
  it("returns 409 for the second Solo bay, names the plan, and isolates Pro capacity", async () => {
    const [a, b] = studios;
    expect((await POST(request(), context(a!))).status).toBe(201);
    const rejected = await POST(request(), context(a!));
    expect(rejected.status).toBe(409);
    expect((await rejected.json()).error).toContain("Solo");
    for (let i = 0; i < 6; i++) expect((await POST(request(), context(b!))).status).toBe(201);
    expect(await studioDb(a!).bay.count()).toBe(1);
    expect(await studioDb(b!).bay.count()).toBe(6);
  });
  it("caps Studio at four; downgrade keeps existing bays and blocks additions until below the limit", async () => {
    const id = studios[2]!;
    for (let i = 0; i < 4; i++) await createBay(id, { name: "Boks" });
    await expect(createBay(id, { name: "Piąty" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Studio") });
    await platformDb.studio.update({ where: { id }, data: { plan: "solo" } });
    await expect(createBay(id, { name: "Nowy" })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Istniejące boksy zostają") });
    expect(await studioDb(id).bay.count()).toBe(4);
    const bays = await studioDb(id).bay.findMany({ orderBy: { sort: "asc" } });
    await studioDb(id).bay.deleteMany({ where: { id: { in: bays.slice(1).map(bay => bay.id) } } });
    await expect(createBay(id, { name: "Nadal pełny" })).rejects.toMatchObject({ status: 409 });
    await studioDb(id).bay.deleteMany();
    await expect(createBay(id, { name: "Wolne miejsce" })).resolves.toMatchObject({ studioId: id });
  });
  it("allows only one concurrent Solo creation", async () => {
    const id = studios[3]!;
    const results = await Promise.allSettled([createBay(id, { name: "A" }), createBay(id, { name: "B" })]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await studioDb(id).bay.count()).toBe(1);
  });
  it("requires owner, session, valid input and matching origin", async () => {
    const id = studios[1]!;
    mocks.session.mockResolvedValue(null);
    expect((await POST(request(), context(id))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: "outsider" } });
    expect((await POST(request(), context(id))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { id: userId } });
    await studioDb(id).membership.updateMany({ where: { userId }, data: { role: "worker" } });
    expect((await POST(request(), context(id))).status).toBe(403);
    await studioDb(id).membership.updateMany({ where: { userId }, data: { role: "owner" } });
    expect((await POST(request({}, "https://evil.example"), context(id))).status).toBe(403);
    for (const data of [{ name: " " }, { name: "Boks", studioId: studios[0] }, { name: "x".repeat(101) }]) {
      expect((await POST(request(data), context(id))).status).toBe(400);
    }
    expect(await studioDb(id).bay.count()).toBe(6);
  });
});
