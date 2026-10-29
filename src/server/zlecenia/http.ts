import { auth } from "../../../lib/auth";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError, authorizeStudio } from "../acl";
import { apiError, limitApiWrite } from "../http";
import { OrderStateError } from "./state";

/** Conceal studios from non-members without hiding billing's read-only 403. */
export async function orderApiStudio(request: Request, studioId: string, permission: "orders:write" | "orders:update") {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new AccessError(401, "Zaloguj się.");
  const member = await studioDb(studioId).membership.findFirst({ where: { userId: session.user.id } });
  if (!member) throw new AccessError(404, "Nie znaleziono studia.");
  const access = await authorizeStudio(session.user.id, studioId, permission, !["GET", "HEAD", "OPTIONS"].includes(request.method));
  await limitApiWrite(request, session.user.id);
  return { ...access, user: session.user };
}

export function orderApiError(error: unknown) {
  if (error instanceof OrderStateError) {
    return Response.json({ error: error.message }, { status: error.code === "not_found" ? 404 : 409 });
  }
  return apiError(error);
}
