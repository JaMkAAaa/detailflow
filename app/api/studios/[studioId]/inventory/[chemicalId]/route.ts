import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { correctChemical } from "@/src/server/magazyn/inventory";

type Context = { params: Promise<{ studioId: string; chemicalId: string }> };
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, chemicalId } = await context.params;
    await apiStudio(request, studioId, "inventory:manage");
    return Response.json(await correctChemical(studioId, chemicalId, await request.json()));
  } catch (error) { return apiError(error); }
}
