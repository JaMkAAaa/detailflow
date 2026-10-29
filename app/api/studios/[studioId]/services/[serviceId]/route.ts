import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { deleteService, updateService } from "@/src/server/wyceny/catalog";

type Context = { params: Promise<{ studioId: string; serviceId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, serviceId } = await context.params;
    await apiStudio(request, studioId, "services:manage");
    return Response.json(await updateService(studioId, serviceId, await request.json()));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, serviceId } = await context.params;
    await apiStudio(request, studioId, "services:manage");
    await deleteService(studioId, serviceId);
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
