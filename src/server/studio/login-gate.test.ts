import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

vi.mock("../../../lib/auth/email", () => ({
  sendAuthMail: async () => undefined,
  sendAuthMailInBackground: () => undefined,
}));

import { hashPassword } from "../../../lib/auth/password";
import { platformDb } from "../../../lib/db/client";
import { studioLoginBlocked } from "./login-gate";

const { auth } = await import("../../../lib/auth");

const tag = randomUUID();
let userId = "";
let studioId = "";

afterAll(async () => {
  await platformDb.session.deleteMany({ where: { userId } });
  if (studioId) await platformDb.studio.deleteMany({ where: { id: studioId } });
  if (userId) await platformDb.user.deleteMany({ where: { id: userId } });
});

describe("odcięcie logowania", () => {
  it("nie wpuszcza do studia, gdy każde konto jest wstrzymane", async () => {
    const user = await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com`, emailVerified: true } });
    userId = user.id;
    const studio = await platformDb.studio.create({
      data: { name: tag, slug: tag, publicCode: tag, status: "suspended" },
    });
    studioId = studio.id;
    await platformDb.membership.create({ data: { studioId, userId, role: "owner" } });
    await platformDb.account.create({
      data: { userId, accountId: userId, providerId: "credential", password: await hashPassword("haslo-testowe-2026") },
    });
    expect(await studioLoginBlocked(userId)).toBe(true);

    const blocked = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: `${tag}@example.com`, password: "haslo-testowe-2026" }),
    }));
    expect(blocked.ok).toBe(false);
    expect(await platformDb.session.count({ where: { userId } })).toBe(0);

    await platformDb.studio.update({ where: { id: studioId }, data: { status: "active" } });
    expect(await studioLoginBlocked(userId)).toBe(false);
    const allowed = await auth.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000" },
      body: JSON.stringify({ email: `${tag}@example.com`, password: "haslo-testowe-2026" }),
    }));
    expect(allowed.ok).toBe(true);
    expect(await platformDb.session.count({ where: { userId } })).toBe(1);
  });
});
