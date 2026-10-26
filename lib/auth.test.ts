// Integracja Better Auth z Postgres (wymaga DATABASE_URL, jak seed.test.ts).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL ??= "http://localhost:3000";
  process.env.AUTH_SECRET ??= "test-secret-0123456789abcdef0123456789";
});

const mails = vi.hoisted(() => [] as { to: string; subject: string; text: string }[]);
vi.mock("./auth/email", () => ({
  sendAuthMail: async (mail: (typeof mails)[number]) => void mails.push(mail),
  sendAuthMailInBackground: (mail: (typeof mails)[number]) => void mails.push(mail),
}));

const { auth } = await import("./auth");
const { platformDb } = await import("./db/client");
const { DEMO, seed } = await import("../prisma/seed");

const APP = process.env.APP_URL!;
const UNKNOWN = "nie-ma-takiego@example.com";

function call(path: string, body?: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${APP}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", origin: APP, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

function sessionCookie(res: Response) {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith("df.session_token="));
  return raw;
}

async function signIn(password: string = DEMO.ownerPassword) {
  return call("/sign-in/email", { email: DEMO.ownerEmail, password });
}

describe("auth (Better Auth + Postgres)", () => {
  let userId: string;

  beforeAll(async () => {
    await seed();
    userId = (await platformDb.user.findUniqueOrThrow({ where: { email: DEMO.ownerEmail } })).id;
  });

  beforeEach(async () => {
    mails.length = 0;
    await platformDb.session.deleteMany({ where: { userId } });
  });

  it("signs in with e-mail + Argon2id password into an httpOnly session stored in Postgres", async () => {
    const res = await signIn();
    expect(res.status).toBe(200);

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const sessions = await platformDb.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const account = await platformDb.account.findFirstOrThrow({ where: { userId, providerId: "credential" } });
    expect(account.password).toMatch(/^\$argon2id\$/);

    const me = await call("/get-session", undefined, cookie!.split(";")[0]);
    expect((await me.json())?.user?.email).toBe(DEMO.ownerEmail);
  });

  it("rejects a wrong password and an unknown e-mail the same way", async () => {
    const wrong = await signIn("zle-haslo-123");
    const unknown = await call("/sign-in/email", { email: UNKNOWN, password: "zle-haslo-123" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(sessionCookie(wrong)).toBeUndefined();
  });

  it("has no public sign-up (accounts come from trial signup and invitations)", async () => {
    const res = await call("/sign-up/email", { email: "nowy@example.com", password: "dlugie-haslo-123", name: "Nowy" });
    expect(res.ok).toBe(false);
    expect(await platformDb.user.findUnique({ where: { email: "nowy@example.com" } })).toBeNull();
  });

  it("signs out by deleting the session row", async () => {
    const cookie = sessionCookie(await signIn())!.split(";")[0]!;
    const res = await call("/sign-out", {}, cookie);
    expect(res.status).toBe(200);
    expect(await platformDb.session.count({ where: { userId } })).toBe(0);
    expect(await (await call("/get-session", undefined, cookie)).json()).toBeNull();
  });

  describe("password reset", () => {
    it("answers identically whether or not the e-mail exists, and mails only real accounts", async () => {
      const known = await call("/request-password-reset", { email: DEMO.ownerEmail, redirectTo: "/reset-password" });
      const unknown = await call("/request-password-reset", { email: UNKNOWN, redirectTo: "/reset-password" });

      expect(known.status).toBe(200);
      expect(unknown.status).toBe(known.status);
      expect(await unknown.json()).toEqual(await known.json());
      expect(mails.map((m) => m.to)).toEqual([DEMO.ownerEmail]);
    });

    it("sets a new password once, revokes existing sessions and invalidates the old password", async () => {
      await signIn();
      await call("/request-password-reset", { email: DEMO.ownerEmail, redirectTo: "/reset-password" });
      const token = /reset-password\/([^?\s]+)/.exec(mails[0]!.text)?.[1];
      expect(token).toBeDefined();

      const tooShort = await call("/reset-password", { token, newPassword: "krotkie" });
      expect(tooShort.ok).toBe(false);

      const res = await call("/reset-password", { token, newPassword: "nowe-haslo-2026" });
      expect(res.status).toBe(200);
      expect(await platformDb.session.count({ where: { userId } })).toBe(0);

      expect((await signIn()).status).toBe(401);
      expect((await signIn("nowe-haslo-2026")).status).toBe(200);
      expect((await call("/reset-password", { token, newPassword: "jeszcze-inne-2026" })).ok).toBe(false);

      await seed(); // przywraca hasło demo dla kolejnych testów
    });
  });

  describe("magic link", () => {
    it("answers identically for unknown e-mails and mails only real accounts", async () => {
      const known = await call("/sign-in/magic-link", { email: DEMO.ownerEmail, callbackURL: "/" });
      const unknown = await call("/sign-in/magic-link", { email: UNKNOWN, callbackURL: "/" });
      expect(known.status).toBe(200);
      expect(await unknown.json()).toEqual(await known.json());
      expect(mails.map((m) => m.to)).toEqual([DEMO.ownerEmail]);
    });

    it("logs in once via the link and stores only a hash of the token", async () => {
      await call("/sign-in/magic-link", { email: DEMO.ownerEmail, callbackURL: "/orders" });
      const url = new URL(/https?:\/\/\S+/.exec(mails[0]!.text)![0]);
      const token = url.searchParams.get("token")!;
      expect(await platformDb.verification.count({ where: { identifier: { contains: token } } })).toBe(0);

      const first = await call(`${url.pathname.replace("/api/auth", "")}${url.search}`);
      expect(first.status).toBe(302);
      expect(first.headers.get("location")).toBe(`${APP}/orders`);
      expect(sessionCookie(first)).toMatch(/HttpOnly/i);

      const second = await call(`${url.pathname.replace("/api/auth", "")}${url.search}`);
      expect(second.headers.get("location")).toMatch(/error=/);
      expect(sessionCookie(second)).toBeUndefined();
    });
  });
});
