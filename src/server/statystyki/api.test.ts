import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { GET } from "../../../app/api/studios/[studioId]/statistics/route";
import { warsawDate } from "../pulpit/metrics";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

const tag = randomUUID();
const users: Record<string, { id: string; email: string; name: string }> = {};
const studios: string[] = [];
const get = (studioId: string, query = "") => GET(new Request(`http://localhost:3000/api/studios/${studioId}/statistics${query}`), { params: Promise.resolve({ studioId }) });

beforeAll(async () => {
  for (const role of ["owner", "manager", "worker", "foreign"] as const) {
    users[role] = await platformDb.user.create({ data: { email: `${tag}-${role}@example.com`, name: role } });
  }
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { status: "active", name: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}` } });
    studios.push(studio.id);
    const db = studioDb(studio.id);
    const roles = suffix === "a" ? (["owner", "manager", "worker"] as const) : (["foreign"] as const);
    for (const role of roles) await db.membership.create({ data: { studioId: studio.id, userId: users[role]!.id, role: role === "foreign" ? "owner" : role } });
    const client = await db.client.create({ data: { studioId: studio.id, name: suffix } });
    const vehicle = await db.vehicle.create({ data: { studioId: studio.id, clientId: client.id, make: "Fiat", model: "Panda", plate: `${tag}-${suffix}` } });
    await db.workOrder.create({ data: { studioId: studio.id, clientId: client.id, vehicleId: vehicle.id, number: "DF-1", status: "completed", service: suffix === "a" ? "Usługa A" : "Usługa B", scheduledFrom: warsawDate(2026, 6, 1, 8), scheduledTo: warsawDate(2026, 6, 1, 9), completedAt: warsawDate(2026, 6, 1, 9), totalGross: suffix === "a" ? "100.00" : "900.00" } });
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("GET /api/studios/:studioId/statistics (Postgres)", () => {
  it("requires a session and an owner of exactly this studio", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await get(studios[0]!, "?from=2026-06-01&to=2026-06-30")).status).toBe(401);
    for (const role of ["manager", "worker"] as const) {
      mocks.session.mockResolvedValue({ user: users[role] });
      expect((await get(studios[0]!, "?from=2026-06-01&to=2026-06-30")).status).toBe(403);
    }
    // An owner of another studio has no access to this one.
    mocks.session.mockResolvedValue({ user: users.foreign });
    expect((await get(studios[0]!, "?from=2026-06-01&to=2026-06-30")).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.owner });
    expect((await get(studios[1]!, "?from=2026-06-01&to=2026-06-30")).status).toBe(403);
  });

  it("returns only the owner's tenant numbers with no-store caching", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const response = await get(studios[0]!, "?from=2026-06-01&to=2026-06-30");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.revenue).toMatchObject({ totalPln: "100.00", orders: 1 });
    expect(JSON.stringify(body)).not.toContain("Usługa B");
    mocks.session.mockResolvedValue({ user: users.foreign });
    expect((await (await get(studios[1]!, "?from=2026-06-01&to=2026-06-30")).json()).revenue.totalPln).toBe("900.00");
  });

  it("marks an empty month as null, not 0", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const body = await (await get(studios[0]!, "?from=2026-05-01&to=2026-06-30")).json();
    expect(body.revenue.months.map((m: { key: string; revenuePln: string | null }) => [m.key, m.revenuePln])).toEqual([["2026-05", null], ["2026-06", "100.00"]]);
  });

  it("answers 400 to an invalid range", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    for (const query of ["?from=2026-06-30&to=2026-06-01", "?from=bad", "?from=2020-01-01&to=2026-01-01"]) expect((await get(studios[0]!, query)).status).toBe(400);
  });
});
