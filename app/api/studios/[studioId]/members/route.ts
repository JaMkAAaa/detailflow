import { auth } from "@/lib/auth";
import { AccessError } from "@/src/server/acl";
import { apiError } from "@/src/server/http";
import { listTeam } from "@/src/server/studio/members";

export async function GET(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new AccessError(401, "Zaloguj się.");
    const { studioId } = await context.params;
    return Response.json(await listTeam(session.user.id, studioId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
