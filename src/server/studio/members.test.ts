import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { authorizeStudio } from "../acl";
import { changeMember, listTeam } from "./members";
import { requireStudio } from "./context";
import { GET } from "../../../app/api/studios/[studioId]/members/route";
import { PATCH, DELETE } from "../../../app/api/studios/[studioId]/members/[membershipId]/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn(), selected: "" };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../../../lib/auth/session", () => ({ requireSession: mocks.session }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: mocks.selected }) }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

const tag = randomUUID();
const users: Record<string, { id: string; email: string; name: string }> = {};
const studios: string[] = [];
const members: Record<string, string> = {};

beforeAll(async () => {
  for (const role of ["owner", "manager", "worker", "foreign"] as const) {
    users[role] = await platformDb.user.create({ data: { email: `${tag}-${role}@example.com`, name: role } });
  }
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { status: "active", name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}` } });
    studios.push(studio.id);
  }
  for (const role of ["owner", "manager", "worker"] as const) {
    members[role] = (await studioDb(studios[0]!).membership.create({ data: { studioId: studios[0]!, userId: users[role]!.id, role } })).id;
  }
  members.foreign = (await studioDb(studios[1]!).membership.create({ data: { studioId: studios[1]!, userId: users.foreign!.id, role: "owner" } })).id;
  await studioDb(studios[1]!).membership.create({ data: { studioId: studios[1]!, userId: users.worker!.id, role: "worker" } });
  for (const [suffix, acceptedAt, expiresAt] of [
    ["pending", null, new Date(Date.now() + 86400000)],
    ["expired", null, new Date(0)],
    ["accepted", new Date(), new Date(Date.now() + 86400000)],
  ] as const) {
    await studioDb(studios[0]!).invitation.create({ data: { studioId: studios[0]!, email: `${tag}-${suffix}@example.com`, role: "worker", tokenHash: `${tag}-${suffix}-secret`, acceptedAt, expiresAt } });
  }
});
afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: studios } } });
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("team management (Postgres)", () => {
  it("lists own members and pending invitations with no hashes or tokens", async () => {
    for (const role of ["owner", "manager"] as const) {
      const team = await listTeam(users[role]!.id, studios[0]!);
      expect(team.members.map((m) => m.user.email)).toEqual([users.owner!.email, users.manager!.email, users.worker!.email]);
      expect(team.invitations).toHaveLength(1);
      expect(team.invitations[0]!.email).toContain("pending");
      expect(JSON.stringify(team)).not.toMatch(/secret|tokenHash|foreign/);
    }
  });
  it("rejects workers, foreign studios and foreign member IDs without changing data", async () => {
    await expect(listTeam(users.worker!.id, studios[0]!)).rejects.toMatchObject({ status: 403 });
    await expect(changeMember(users.worker!.id, studios[0]!, members.manager!, "worker")).rejects.toMatchObject({ status: 403 });
    await expect(listTeam(users.manager!.id, studios[1]!)).rejects.toMatchObject({ status: 404 });
    await expect(changeMember(users.manager!.id, studios[1]!, members.foreign!)).rejects.toMatchObject({ status: 404 });
    await expect(changeMember(users.owner!.id, studios[0]!, members.foreign!, "worker")).rejects.toMatchObject({ status: 404 });
    await expect(changeMember(users.owner!.id, studios[0]!, "missing")).rejects.toMatchObject({ status: 404 });
    expect(await studioDb(studios[1]!).membership.findFirst({ where: { id: members.foreign } })).toMatchObject({ role: "owner" });
  });
  it("returns HTTP 401/403/404 and enforces origin for member mutations", async () => {
    const request = new Request("http://localhost:3000/api/studios/team");
    const context = (studioId: string) => ({ params: Promise.resolve({ studioId }) });
    mocks.session.mockResolvedValue(null);
    expect((await GET(request, context(studios[0]!))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: users.worker });
    expect((await GET(request, context(studios[0]!))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.manager });
    expect((await GET(request, context(studios[1]!))).status).toBe(404);
    const allowed = await GET(request, context(studios[0]!));
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    for (const handler of [PATCH, DELETE]) {
      const response = await handler(new Request(request.url, { method: handler === PATCH ? "PATCH" : "DELETE", headers: { origin: "https://evil.example" } }),
        { params: Promise.resolve({ studioId: studios[0]!, membershipId: members.worker! }) });
      expect(response.status).toBe(403);
    }
  });
  it("cannot assign owner or change/remove the last owner, even as manager", async () => {
    await expect(changeMember(users.owner!.id, studios[0]!, members.worker!, "owner")).rejects.toThrow();
    for (const role of ["owner", "manager"] as const) {
      await expect(changeMember(users[role]!.id, studios[0]!, members.owner!)).rejects.toMatchObject({ status: 409 });
      await expect(changeMember(users[role]!.id, studios[0]!, members.owner!, "worker")).rejects.toMatchObject({ status: 409 });
    }
    expect(await studioDb(studios[0]!).membership.count({ where: { role: "owner" } })).toBe(1);
  });
  it("applies role changes immediately to ACL, keeping billing owner-only", async () => {
    await changeMember(users.manager!.id, studios[0]!, members.worker!, "manager");
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "members:invite")).resolves.toBeDefined();
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "billing:manage")).rejects.toMatchObject({ status: 403 });
    await changeMember(users.owner!.id, studios[0]!, members.worker!, "worker");
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "members:invite")).rejects.toMatchObject({ status: 403 });
    await expect(authorizeStudio(users.manager!.id, studios[0]!, "billing:manage")).rejects.toMatchObject({ status: 403 });
  });
  it("removes only membership; requireStudio stops accepting it while the other studio survives", async () => {
    mocks.session.mockResolvedValue({ user: users.worker });
    mocks.selected = studios[0]!;
    expect((await requireStudio()).studioId).toBe(studios[0]);
    await changeMember(users.manager!.id, studios[0]!, members.worker!);
    await expect(authorizeStudio(users.worker!.id, studios[0]!)).rejects.toMatchObject({ status: 403 });
    // requireStudio can select the remaining studio, never the removed one.
    expect((await requireStudio()).studioId).toBe(studios[1]);
    expect(await platformDb.user.findUnique({ where: { id: users.worker!.id } })).not.toBeNull();
    expect(await studioDb(studios[1]!).membership.findFirst({ where: { userId: users.worker!.id } })).not.toBeNull();
    await changeMember(users.foreign!.id, studios[1]!, (await studioDb(studios[1]!).membership.findFirstOrThrow({ where: { userId: users.worker!.id } })).id);
    await expect(requireStudio()).rejects.toThrow("NOT_FOUND");
  });
  it("audits successful changes with actor, tenant and no invitation secrets", async () => {
    const logs = await platformDb.auditLog.findMany({ where: { studioId: studios[0] }, orderBy: { createdAt: "asc" } });
    expect(logs.map((log) => log.action)).toEqual(["studio.member.role", "studio.member.role", "studio.member.remove"]);
    expect(logs.map((log) => log.actorId)).toEqual([users.manager!.id, users.owner!.id, users.manager!.id]);
    expect(JSON.stringify(logs)).not.toMatch(/secret|tokenHash/);
  });
});
