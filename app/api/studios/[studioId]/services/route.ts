import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { createService, listServices } from "@/src/server/wyceny/catalog";

type Context = { params: Promise<{ studioId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "services:manage");
    return Response.json(await listServices(studioId));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "services:manage");
    return Response.json(await createService(studioId, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
