import { beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

vi.mock("./email", () => ({
  sendAuthMail: async () => undefined,
  sendAuthMailInBackground: () => undefined,
}));

const { platformAuth } = await import("./platform");
const { DEMO, seed } = await import("../../prisma/seed");
const { PLATFORM_DEMO } = await import("../../prisma/seed-platform");

const APP = process.env.APP_URL!;

function call(path: string, body: unknown) {
  return platformAuth.handler(
    new Request(`${APP}/api/auth/platform${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: APP },
      body: JSON.stringify(body),
    }),
  );
}

describe("platform auth (osobna sesja, nie membership)", () => {
  beforeAll(async () => {
    await seed();
  });

  it("rejects a studio owner and accepts a platform operator with a distinct cookie", async () => {
    const studio = await call("/sign-in/email", { email: DEMO.ownerEmail, password: DEMO.ownerPassword });
    expect(studio.ok).toBe(false);
    expect(studio.headers.getSetCookie().some((c) => c.startsWith("df-plat.session_token="))).toBe(false);

    const operator = await call("/sign-in/email", { email: PLATFORM_DEMO.email, password: PLATFORM_DEMO.password });
    expect(operator.ok).toBe(true);
    expect(operator.headers.getSetCookie().some((c) => c.startsWith("df-plat.session_token="))).toBe(true);
    expect(operator.headers.getSetCookie().some((c) => c.startsWith("df.session_token="))).toBe(false);
  });
});
