import { randomBytes } from "node:crypto";
import { afterAll, expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});
vi.mock("./email", () => ({ sendAuthMailInBackground: vi.fn() }));
const { auth } = await import("../auth");
const { clearLoginFailures } = await import("./lockout");
const email = `rate-limit-${randomBytes(12).toString("hex")}@example.com`;
afterAll(() => clearLoginFailures("studio", email));

it("enforces the existing auth thresholds through the configured custom storage", async () => {
  const context = await auth.$context;
  context.rateLimit.enabled = true;
  // Each invocation gets its own valid IP bucket, including repeated full-suite runs.
  const clientIp = `2001:db8:${randomBytes(12).toString("hex").match(/.{4}/g)!.join(":")}`;
  const cases = [
    ["/sign-in/email", 5, { email, password: "invalid-password" }],
    ["/request-password-reset", 3, { email }],
    ["/reset-password", 5, { token: "invalid-token", newPassword: "new-invalid-password" }],
    ["/change-password", 5, { currentPassword: "invalid-password", newPassword: "new-invalid-password" }],
    ["/sign-in/magic-link", 5, { email }],
  ] as const;
  for (const [path, max, body] of cases) {
    const call = () => auth.handler(new Request(`${process.env.APP_URL}/api/auth${path}`, {
      method: "POST", headers: { "x-forwarded-for": clientIp, origin: process.env.APP_URL!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    for (let i = 0; i < max; i++) expect((await call()).status).not.toBe(429);
    const denied = await call();
    expect(denied.status).toBe(429);
    expect(await denied.json()).toEqual({ message: "Too many requests. Please try again later." });
  }
});
