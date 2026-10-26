import { apiStudio, checkOrigin } from "@/src/server/http";
import { orderErrorResponse } from "@/src/server/zlecenia/errors";
import { getProtocol, saveProtocol } from "@/src/server/zlecenia/intake";

type Context = { params: Promise<{ studioId: string; workOrderId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await getProtocol(studioId, workOrderId));
  } catch (error) { return orderErrorResponse(error); }
}

/** Tworzy protokół lub zastępuje jego punkty uszkodzeń (do akceptacji klienta). */
export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    const { user } = await apiStudio(request, studioId, "orders:write");
    return Response.json(await saveProtocol(studioId, workOrderId, user.id, await request.json()));
  } catch (error) { return orderErrorResponse(error); }
}
