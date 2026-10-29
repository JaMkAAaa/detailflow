import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { createChemical, listChemicals } from "@/src/server/magazyn/inventory";

type Context = { params: Promise<{ studioId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "studio:read");
    return Response.json(await listChemicals(studioId));
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "inventory:manage");
    return Response.json(await createChemical(studioId, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
