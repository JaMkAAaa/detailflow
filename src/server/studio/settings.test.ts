import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { authorizeStudio } from "../acl";
import { decryptTestToken } from "../../ksef/secrets";
import { PATCH } from "../../../app/api/studios/[studioId]/settings/route";
import { PUT } from "../../../app/api/studios/[studioId]/ksef/token/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.KSEF_ENV = "test";
  process.env.KSEF_API_URL = "https://api-test.ksef.mf.gov.pl/v2";
  process.env.KSEF_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  return { session: vi.fn() };
});
vi.mock("../../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));

const tag = randomUUID();
const token = "fixture-ksef-token-124";
const users: Record<string, { id: string; email: string }> = {};
let studioA = "";
let studioB = "";
const nipA = "5260250274";
const nipB = "1111111111";
const nextNip = "7012345671";
const profile = {
  name: "Studio A po zmianie",
  ownerLegalName: "Studio A Sp. z o.o.",
  nip: "701-234-56-71",
  address: "ul. Testowa 1",
  postal: "00-001",
  city: "Warszawa",
  phone: "+48 600 100 128",
};
const studioBProfile = {
  name: "Studio B",
  ownerLegalName: "Studio B",
  nip: nipB,
  address: "ul. B 2",
  postal: "30-001",
  city: "Kraków",
  phone: "+48 600 200 200",
};

const origin = "http://localhost:3000";
function patch(studioId: string, body: unknown, requestOrigin = origin) {
  return PATCH(new Request(`${origin}/api/studios/${studioId}/settings`, {
    method: "PATCH",
    headers: { origin: requestOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ studioId }) });
}
function putToken(studioId: string, value: string) {
  return PUT(new Request(`${origin}/api/studios/${studioId}/ksef/token`, {
    method: "PUT",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token: value }),
  }), { params: Promise.resolve({ studioId }) });
}

beforeAll(async () => {
  for (const role of ["owner", "manager", "worker"] as const) {
    users[role] = await platformDb.user.create({ data: { email: `${tag}-${role}@example.com`, name: role } });
  }
  const [a, b] = await Promise.all([
    platformDb.studio.create({ data: { status: "active", publicCode: `${tag}-a`, slug: `${tag}-a`, name: "Studio A", nip: nipA, ksefEnv: "test" } }),
    platformDb.studio.create({ data: { status: "active", publicCode: `${tag}-b`, slug: `${tag}-b`, name: studioBProfile.name, ownerLegalName: studioBProfile.ownerLegalName, nip: nipB, address: studioBProfile.address, postal: studioBProfile.postal, city: studioBProfile.city, phone: studioBProfile.phone, ksefEnv: "test" } }),
  ]);
  studioA = a.id;
  studioB = b.id;
  for (const role of ["owner", "manager", "worker"] as const) {
    await platformDb.membership.create({ data: { studioId: studioA, userId: users[role]!.id, role } });
  }
});

afterAll(async () => {
  const ids = [studioA, studioB].filter(Boolean);
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: ids } } });
  await platformDb.studio.deleteMany({ where: { id: { in: ids } } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: tag } } });
});

describe("studio settings and KSeF token (Postgres)", () => {
  it("allows the owner and rejects manager and worker", async () => {
    await expect(authorizeStudio(users.owner!.id, studioA, "studio:settings")).resolves.toBeDefined();
    await expect(authorizeStudio(users.manager!.id, studioA, "studio:settings")).rejects.toMatchObject({ status: 403 });
    await expect(authorizeStudio(users.worker!.id, studioA, "studio:settings")).rejects.toMatchObject({ status: 403 });
  });

  it("returns 401 without a session and 403 for manager, worker and the other studio", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await patch(studioA, profile)).status).toBe(401);
    expect((await putToken(studioA, token)).status).toBe(401);
    for (const role of ["manager", "worker"] as const) {
      mocks.session.mockResolvedValue({ user: users[role] });
      expect((await patch(studioA, profile)).status).toBe(403);
      expect((await putToken(studioA, token)).status).toBe(403);
    }
    mocks.session.mockResolvedValue({ user: users.owner });
    const beforeA = await platformDb.studio.findUnique({ where: { id: studioA }, select: { nip: true, ksefTokenEnc: true } });
    const beforeB = await platformDb.studio.findUnique({ where: { id: studioB }, select: { nip: true, ksefTokenEnc: true } });
    expect((await patch(studioB, profile)).status).toBe(403);
    expect((await putToken(studioB, token)).status).toBe(403);
    expect(await platformDb.studio.findUnique({ where: { id: studioA }, select: { nip: true, ksefTokenEnc: true } })).toEqual(beforeA);
    expect(await platformDb.studio.findUnique({ where: { id: studioB }, select: { nip: true, ksefTokenEnc: true } })).toEqual(beforeB);
  });

  it("rejects a bad NIP checksum and a body that tries to smuggle a token", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const badNip = await patch(studioA, { ...profile, nip: "5260250275" });
    expect(badNip.status).toBe(400);
    expect(await badNip.json()).toEqual({ error: "Nieprawidłowe dane studia." });
    const before = await platformDb.studio.findUnique({ where: { id: studioA }, select: { nip: true, ksefTokenEnc: true } });
    const smuggled = await patch(studioA, { ...profile, token });
    expect(smuggled.status).toBe(400);
    expect(JSON.stringify(await smuggled.json())).not.toContain(token);
    expect(await platformDb.studio.findUnique({ where: { id: studioA }, select: { nip: true, ksefTokenEnc: true } })).toEqual(before);
  });

  it("updates studio A without changing studio B or the stored token", async () => {
    mocks.session.mockResolvedValue({ user: users.owner });
    const saved = await putToken(studioA, token);
    expect(saved.status).toBe(204);
    expect(await saved.text()).toBe("");
    const encrypted = await platformDb.studio.findUniqueOrThrow({ where: { id: studioA }, select: { ksefTokenEnc: true } });
    expect(encrypted.ksefTokenEnc).not.toContain(token);
    expect(decryptTestToken(studioA, encrypted.ksefTokenEnc!)).toBe(token);

    const response = await patch(studioA, profile);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ ...profile, nip: nextNip });
    expect(json).not.toHaveProperty("ksefTokenEnc");
    expect(json).not.toHaveProperty("token");
    expect(JSON.stringify(json)).not.toContain(token);

    const again = await platformDb.studio.findUniqueOrThrow({ where: { id: studioA }, select: { nip: true, ksefTokenEnc: true } });
    expect(again.nip).toBe(nextNip);
    expect(decryptTestToken(studioA, again.ksefTokenEnc!)).toBe(token);
    expect(await platformDb.studio.findUnique({ where: { id: studioB }, select: { name: true, ownerLegalName: true, nip: true, address: true, postal: true, city: true, phone: true, ksefTokenEnc: true } })).toEqual({ ...studioBProfile, ksefTokenEnc: null });

    const logs = await platformDb.auditLog.findMany({ where: { studioId: { in: [studioA, studioB] } } });
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(token);
    expect(logs.map((log) => log.action).sort()).toEqual(["studio.ksef.token", "studio.profile.update"]);
    expect(logs.find((log) => log.action === "studio.ksef.token")?.meta).toEqual({ updated: true });
  });
});
