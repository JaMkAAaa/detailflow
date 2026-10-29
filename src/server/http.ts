import { API_WRITE_RULE, counterKey, sharedCounter } from "./rate-limit";
import { auth } from "../../lib/auth";
import { env } from "../../lib/env";
import { AccessError, authorizeStudio, type Permission } from "./acl";
import { ZodError } from "zod";

export async function apiStudio(request: Request, studioId: string, permission?: Permission) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new AccessError(401, "Zaloguj się.");
  const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const access = await authorizeStudio(session.user.id, studioId, permission, write);
  await limitApiWrite(request, session.user.id);
  return { ...access, user: session.user };
}

export async function limitApiWrite(request: Request, userId: string) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  let decision;
  try { decision = await sharedCounter().consume(counterKey("api-write", userId), API_WRITE_RULE); }
  catch { throw new RateLimitError(503); }
  if (!decision.allowed) throw new RateLimitError(429, decision.retryAfter ?? API_WRITE_RULE.window);
}

export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin) throw new AccessError(403, "Niedozwolone źródło żądania.");
}

export class RateLimitError extends Error {
  constructor(public status: 429 | 503, public retryAfter = 60) { super("Spróbuj ponownie później."); }
}

export function apiError(error: unknown): Response {
  if (error instanceof RateLimitError) return Response.json({ error: error.message }, {
    status: error.status, headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" },
  });
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  throw error;
}
