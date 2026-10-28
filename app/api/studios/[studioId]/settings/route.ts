import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { updateStudioProfile } from "@/src/server/studio/profile";

export async function PATCH(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "studio:settings");
    return Response.json(await updateStudioProfile(studioId, user.id, await request.json()));
  } catch (error) { return apiError(error); }
}
