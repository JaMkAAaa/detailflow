import { createHash } from "node:crypto";
import { createAuthMiddleware, isAPIError } from "better-auth/api";
import { platformDb } from "../db/client";

export const LOCKOUT_LIMIT = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const LOCKED = "Zbyt wiele prób logowania. Spróbuj ponownie później.";

export type LockoutRealm = "studio" | "platform";

export function lockoutSubject(realm: LockoutRealm, email: string) {
  return createHash("sha256").update(`${realm}:${email.trim().toLowerCase()}`).digest("hex");
}

function emailFrom(body: unknown) {
  if (!body || typeof body !== "object" || !("email" in body)) return "";
  const email = body.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export async function assertNotLocked(realm: LockoutRealm, email: string) {
  const row = await platformDb.authLockout.findUnique({ where: { subjectHash: lockoutSubject(realm, email) } });
  if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    const { APIError } = await import("better-auth/api");
    throw new APIError("TOO_MANY_REQUESTS", { message: LOCKED });
  }
}

export async function recordLoginFailure(realm: LockoutRealm, email: string) {
  const subjectHash = lockoutSubject(realm, email);
  const now = new Date();
  const row = await platformDb.authLockout.findUnique({ where: { subjectHash } });
  const fresh = !row || now.getTime() - row.windowStart.getTime() > LOCKOUT_WINDOW_MS;
  const failures = fresh ? 1 : row.failures + 1;
  const lockedUntil = failures >= LOCKOUT_LIMIT ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;
  await platformDb.authLockout.upsert({
    where: { subjectHash },
    create: { subjectHash, failures, windowStart: now, lockedUntil },
    update: { failures, windowStart: fresh ? now : row!.windowStart, lockedUntil },
  });
}

export async function clearLoginFailures(realm: LockoutRealm, email: string) {
  await platformDb.authLockout.deleteMany({ where: { subjectHash: lockoutSubject(realm, email) } });
}

export function loginLockoutHooks(realm: LockoutRealm) {
  return {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailFrom(ctx.body);
      if (!email) return;
      await assertNotLocked(realm, email);
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = emailFrom(ctx.body);
      if (!email) return;
      const returned = ctx.context.returned;
      if (isAPIError(returned) && returned.statusCode === 401) {
        await recordLoginFailure(realm, email);
        return;
      }
      if (isAPIError(returned)) return;
      await clearLoginFailures(realm, email);
    }),
  };
}
