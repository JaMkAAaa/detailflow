import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { createBay } from "@/src/server/kalendarz/bays";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "studio:settings");
    return Response.json(await createBay(studioId, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
