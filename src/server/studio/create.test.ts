import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { verifyPassword } from "../../../lib/auth/password";
import { createTrialStudio, SignupError } from "./create";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

const { auth } = await import("../../../lib/auth");
const tag = randomUUID();
const studioName = `Trial test ${tag}`;
const input = (suffix: string) => ({
  name: "Anna Testowa", studioName,
  email: `trial-${tag}-${suffix}@example.com`, password: "trial-password-2026",
});

afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { name: studioName } });
  await platformDb.user.deleteMany({ where: { email: { startsWith: `trial-${tag}-` } } });
});

describe("trial signup (Postgres)", () => {
  it("creates a Solo trial for exactly 14 days, owner and login credentials without Stripe", async () => {
    const before = Date.now();
    const { studio, userId, email } = await createTrialStudio({ ...input("owner"), email: `  ${input("owner").email.toUpperCase()}  ` });
    expect(email).toBe(input("owner").email);
    expect(studio).toMatchObject({ status: "trial", plan: "solo", stripeCustomerId: null, stripeSubscriptionId: null });
    const end = studio.trialEndsAt!.getTime();
    expect(end).toBeGreaterThanOrEqual(before + 14 * 86400000);
    expect(end).toBeLessThanOrEqual(Date.now() + 14 * 86400000);
    expect(await studioDb(studio.id).membership.findMany()).toMatchObject([{ userId, studioId: studio.id, role: "owner" }]);
    const account = await platformDb.account.findFirstOrThrow({ where: { userId } });
    expect(account).toMatchObject({ providerId: "credential", accountId: userId });
    expect(await verifyPassword({ hash: account.password!, password: input("owner").password })).toBe(true);

    const response = await auth.handler(new Request(`${process.env.APP_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: process.env.APP_URL! },
      body: JSON.stringify({ email, password: input("owner").password }),
    }));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(";")).toMatch(/df.session_token=.*HttpOnly/i);
    expect(await platformDb.session.count({ where: { userId } })).toBe(1);

    await expect(createTrialStudio(input("owner"))).rejects.toThrow(SignupError);
    expect(await platformDb.studio.count({ where: { name: studioName } })).toBe(1);
  });

  it("allows only one concurrent signup for the same email, rolling back the losing studio", async () => {
    const before = await platformDb.studio.count({ where: { name: studioName } });
    const results = await Promise.allSettled([createTrialStudio(input("race")), createTrialStudio(input("race"))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(SignupError);
    expect(await platformDb.studio.count({ where: { name: studioName } })).toBe(before + 1);
  });

  it("isolates the owners of two newly registered studios", async () => {
    const a = await createTrialStudio(input("a"));
    const b = await createTrialStudio(input("b"));
    expect(await studioDb(a.studio.id).membership.findMany()).toMatchObject([{ userId: a.userId }]);
    expect(await studioDb(a.studio.id).membership.findFirst({ where: { userId: b.userId } })).toBeNull();
    expect(await studioDb(b.studio.id).membership.findFirst({ where: { userId: a.userId } })).toBeNull();
  });

  it("rejects invalid input before creating a studio or user", async () => {
    const before = await platformDb.studio.count({ where: { name: studioName } });
    for (const invalid of [{ password: "short" }, { password: "x".repeat(129) }, { email: "invalid" }, { studioName: " " }, { name: " " }]) {
      await expect(createTrialStudio({ ...input("invalid"), ...invalid })).rejects.toThrow(SignupError);
    }
    expect(await platformDb.studio.count({ where: { name: studioName } })).toBe(before);
    expect(await platformDb.user.findUnique({ where: { email: input("invalid").email } })).toBeNull();
  });
});
