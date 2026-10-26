import { auth } from "../../lib/auth";
import { env } from "../../lib/env";
import { AccessError, authorizeStudio, type Permission } from "./acl";
import { ZodError } from "zod";

export async function apiStudio(request: Request, studioId: string, permission?: Permission) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new AccessError(401, "Zaloguj się.");
  return { ...await authorizeStudio(session.user.id, studioId, permission), user: session.user };
}

export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(env.APP_URL).origin) throw new AccessError(403, "Niedozwolone źródło żądania.");
}

export function apiError(error: unknown): Response {
  if (error instanceof AccessError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return Response.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  throw error;
}
