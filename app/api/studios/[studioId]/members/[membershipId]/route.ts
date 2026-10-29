import { auth } from "@/lib/auth";
import { AccessError } from "@/src/server/acl";
import { apiError, checkOrigin, limitApiWrite } from "@/src/server/http";
import { changeMember } from "@/src/server/studio/members";
import { z } from "zod";

type Context = { params: Promise<{ studioId: string; membershipId: string }> };
const input = z.object({ role: z.enum(["manager", "worker"]) }).strict();
async function update(request: Request, context: Context, remove: boolean) {
  try {
    checkOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new AccessError(401, "Zaloguj się.");
    await limitApiWrite(request, session.user.id);
    const { studioId, membershipId } = await context.params;
    await changeMember(session.user.id, studioId, membershipId, remove ? undefined : input.parse(await request.json()).role);
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) { return update(request, context, false); }
export async function DELETE(request: Request, context: Context) { return update(request, context, true); }
