import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../lib/db/client";
import { studioDb } from "../../lib/db/tenant";
import { authorizeStudio } from "./acl";
import { acceptInvitation, inviteMember } from "./studio/invitations";
import { GET } from "../../app/api/studios/[studioId]/invoices/[invoiceId]/route";
import { POST as selectStudio } from "../../app/api/studios/active/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn(), mail: vi.fn() };
});
vi.mock("../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../../lib/auth/email", () => ({ sendAuthMail: mocks.mail }));

const tag = randomUUID();
const users: Record<string, { id: string; email: string }> = {};
const studios: string[] = [];
const invoices: string[] = [];
const request = () => new Request("http://localhost:3000/api/studios");
const context = (studioId: string, invoiceId: string) => ({ params: Promise.resolve({ studioId, invoiceId }) });

beforeAll(async () => {
  for (const role of ["owner", "manager", "worker", "guest"] as const) {
    users[role] = await platformDb.user.create({ data: { email: `${tag}-${role}@example.com`, name: role } });
  }
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { status: "active", name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}` } });
    studios.push(studio.id);
    const db = studioDb(studio.id);
    for (const role of ["owner", "manager", "worker"] as const) {
      if (suffix === "b" && role !== "owner") continue;
      await db.membership.create({ data: { studioId: studio.id, userId: users[role]!.id, role } });
    }
    const client = await db.client.create({ data: { studioId: studio.id, name: suffix } });
    const vehicle = await db.vehicle.create({ data: { studioId: studio.id, clientId: client.id, make: "Fiat", model: "Panda", plate: suffix } });
    const order = await db.workOrder.create({ data: { studioId: studio.id, clientId: client.id, vehicleId: vehicle.id, number: "DF-1", status: "completed", service: "Mycie", scheduledFrom: new Date(), scheduledTo: new Date(), completedAt: new Date(), totalGross: "123" } });
    const invoice = await db.invoice.create({ data: { studioId: studio.id, workOrderId: order.id, number: "FV/1", status: "issued", ksefEnv: "test", buyerName: suffix, totalNet: "100", totalVat: "23", totalGross: "123" } });
    invoices.push(invoice.id);
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("ACL and the same invoice endpoint across two tenants (Postgres)", () => {
  it("allows owner/manager invoice permission and denies worker", async () => {
    for (const role of ["owner", "manager"] as const) await expect(authorizeStudio(users[role]!.id, studios[0]!, "invoices:manage")).resolves.toBeDefined();
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "invoices:manage")).rejects.toMatchObject({ status: 403 });
    await expect(authorizeStudio(users.worker!.id, studios[0]!, "members:invite")).rejects.toMatchObject({ status: 403 });
  });
  it("returns 401 without a session, 403 for a foreign studio and worker", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request(), context(studios[0]!, invoices[0]!))).status).toBe(401);
    mocks.session.mockResolvedValue({ user: users.manager });
    expect((await GET(request(), context(studios[1]!, invoices[1]!))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: users.worker });
    expect((await GET(request(), context(studios[0]!, invoices[0]!))).status).toBe(403);
  });
  it("returns only scoped records; foreign and nonexistent IDs have identical 404s", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    for (const index of [0, 1]) {
      const response = await GET(request(), context(studios[index]!, invoices[index]!));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ studioId: studios[index], buyerName: index === 0 ? "a" : "b" });
    }
    const foreign = await GET(request(), context(studios[0]!, invoices[1]!));
    const missing = await GET(request(), context(studios[0]!, "missing"));
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
  });
  it("checks picker membership and origin before setting the cookie", async () => {
    mocks.session.mockResolvedValue({ user: users.manager });
    const select = (studioId: string, origin = "http://localhost:3000") => selectStudio(new Request("http://localhost:3000/api/studios/active", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ studioId }) }));
    const forbidden = await select(studios[1]!);
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.get("set-cookie")).toBeNull();
    expect((await select(studios[0]!, "https://evil.example")).status).toBe(403);
    const allowed = await select(studios[0]!);
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("set-cookie")).toContain("HttpOnly");
    expect(allowed.headers.get("set-cookie")).toContain(studios[0]);
  });
});

async function invite(role = "worker") {
  mocks.mail.mockClear();
  const result = await inviteMember(users.owner!.id, studios[0]!, { email: users.guest!.email.toUpperCase(), role });
  const mail = mocks.mail.mock.calls[0]![0] as { text: string };
  return { ...result, token: mail.text.match(/\/invite\/([a-f0-9]{64})/)![1]! };
}

describe("invitations (Postgres)", () => {
  it("provisions a new account without granting membership before acceptance", async () => {
    const email = `${tag}-new@example.com`;
    mocks.mail.mockClear();
    await inviteMember(users.manager!.id, studios[0]!, { email, role: "worker" });
    const user = await platformDb.user.findUniqueOrThrow({ where: { email } });
    expect(await studioDb(studios[0]!).membership.findFirst({ where: { userId: user.id } })).toBeNull();
    const token = (mocks.mail.mock.calls[0]![0] as { text: string }).text.match(/\/invite\/([a-f0-9]{64})/)![1]!;
    await acceptInvitation(user, token);
    expect(await studioDb(studios[0]!).membership.findFirst({ where: { userId: user.id } })).toMatchObject({ role: "worker" });
  });
  it("rejects worker invitations and assigning owner", async () => {
    await expect(inviteMember(users.worker!.id, studios[0]!, { email: users.guest!.email, role: "worker" })).rejects.toMatchObject({ status: 403 });
    await expect(invite("owner")).rejects.toThrow();
  });
  it("stores only a hash, binds acceptance to email, and consumes once atomically", async () => {
    const { token, id } = await invite();
    const record = await studioDb(studios[0]!).invitation.findUniqueOrThrow({ where: { id } });
    expect(record.tokenHash).not.toBe(token);
    await expect(acceptInvitation(users.manager!, token)).rejects.toMatchObject({ status: 403 });
    const results = await Promise.allSettled([acceptInvitation(users.guest!, token), acceptInvitation(users.guest!, token)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await studioDb(studios[0]!).membership.findFirst({ where: { userId: users.guest!.id } })).toMatchObject({ role: "worker" });
    expect(await studioDb(studios[1]!).membership.findFirst({ where: { userId: users.guest!.id } })).toBeNull();
    await expect(acceptInvitation(users.guest!, token)).rejects.toMatchObject({ status: 404 });
  });
  it("rejects expired tokens and preserves existing roles", async () => {
    const expired = await invite();
    await studioDb(studios[0]!).invitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } });
    await expect(acceptInvitation(users.guest!, expired.token)).rejects.toMatchObject({ status: 404 });
    const fresh = await invite("manager");
    await acceptInvitation(users.guest!, fresh.token);
    expect(await studioDb(studios[0]!).membership.findFirst({ where: { userId: users.guest!.id } })).toMatchObject({ role: "worker" });
  });
});
