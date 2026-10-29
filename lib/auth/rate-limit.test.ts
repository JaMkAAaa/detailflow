import { expect, it, vi } from "vitest";
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});
vi.mock("./email", () => ({ sendAuthMailInBackground: vi.fn() }));
const { auth } = await import("../auth");

it("enforces the existing auth thresholds through the configured custom storage", async () => {
  const context = await auth.$context;
  context.rateLimit.enabled = true;
  const cases = [
    ["/sign-in/email", 5, { email: "rate-limit-unknown@example.com", password: "invalid-password" }],
    ["/request-password-reset", 3, { email: "rate-limit-unknown@example.com" }],
    ["/reset-password", 5, { token: "invalid-token", newPassword: "new-invalid-password" }],
    ["/sign-in/magic-link", 5, { email: "rate-limit-unknown@example.com" }],
  ] as const;
  for (const [path, max, body] of cases) {
    const call = () => auth.handler(new Request(`${process.env.APP_URL}/api/auth${path}`, {
      method: "POST", headers: { origin: process.env.APP_URL!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    for (let i = 0; i < max; i++) expect((await call()).status).not.toBe(429);
    const denied = await call();
    expect(denied.status).toBe(429);
    expect(await denied.json()).toEqual({ message: "Too many requests. Please try again later." });
  }
});
