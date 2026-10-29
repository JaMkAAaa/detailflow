import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { connectStudio } from "@/src/server/client-payments/connect";
export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "studio:settings");
    return Response.json(await connectStudio(studioId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
