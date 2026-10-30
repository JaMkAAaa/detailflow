import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { readOwnAccount } from "./query";
import { PATCH } from "@/app/api/account/preferences/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID();
let a: string, b: string, sessionId: string;
const studios: string[] = [];
beforeAll(async () => {
  a = (await platformDb.user.create({ data: { email: `${tag}-a@example.com`, name: "A" } })).id;
  b = (await platformDb.user.create({ data: { email: `${tag}-b@example.com`, name: "B" } })).id;
  for (const [index, userId] of [a, b].entries()) {
    const studio = await platformDb.studio.create({ data: { name: tag, publicCode: `${tag}-${index}`, slug: `${tag}-${index}`, status: "past_due" } });
    studios.push(studio.id);
    await studioDb(studio.id).membership.create({ data: { studioId: studio.id, userId, role: "worker" } });
    const session = await platformDb.session.create({ data: { userId, token: `private-${userId}`, expiresAt: new Date(Date.now() + 60_000) } });
    if (userId === a) sessionId = session.id;
  }
  await platformDb.session.create({ data: { userId: a, token: `expired-${a}`, expiresAt: new Date(0) } });
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: studios } } });
  await platformDb.user.deleteMany({ where: { id: { in: [a, b] } } });
});
const request = (body: unknown, origin: string | null = "http://localhost:3000") => new Request("http://localhost:3000/api/account/preferences", {
  method: "PATCH", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body),
});
it("lists only the account's active sessions without tokens, passwords or foreign data", async () => {
  const account = await readOwnAccount(a, sessionId);
  expect(account.trialReminderEnabled).toBe(true);
  expect(account.sessions).toHaveLength(1);
  expect(account.sessions[0]).toMatchObject({ id: sessionId, current: true });
  expect(JSON.stringify(account)).not.toMatch(/private-|expired-|password|token/);
  expect(account.email).not.toContain("-b@");
});
it("requires a session and Origin and rejects attempts to target another user", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await PATCH(request({ trialReminderEnabled: false }))).status).toBe(401);
  mocks.session.mockResolvedValue({ user: { id: a } });
  for (const origin of [null, "https://evil.example"]) expect((await PATCH(request({ trialReminderEnabled: false }, origin))).status).toBe(403);
  for (const body of [{ trialReminderEnabled: "false" }, { trialReminderEnabled: false, userId: b }, {}]) expect((await PATCH(request(body))).status).toBe(400);
});
it("saves only the authenticated user's preference, also for a worker with restricted billing", async () => {
  mocks.session.mockResolvedValue({ user: { id: a } });
  expect((await PATCH(request({ trialReminderEnabled: false }))).status).toBe(200);
  expect((await readOwnAccount(a, sessionId)).trialReminderEnabled).toBe(false);
  expect((await readOwnAccount(b, "other")).trialReminderEnabled).toBe(true);
  expect((await PATCH(request({ trialReminderEnabled: true }))).status).toBe(200);
  expect((await readOwnAccount(a, sessionId)).trialReminderEnabled).toBe(true);
});
