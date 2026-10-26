import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { inviteMember } from "@/src/server/studio/invitations";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "members:invite");
    return Response.json(await inviteMember(user.id, studioId, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
