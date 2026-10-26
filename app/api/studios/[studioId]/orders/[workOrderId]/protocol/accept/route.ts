import { apiStudio, checkOrigin } from "@/src/server/http";
import { orderErrorResponse } from "@/src/server/zlecenia/errors";
import { acceptProtocol } from "@/src/server/zlecenia/intake";

type Context = { params: Promise<{ studioId: string; workOrderId: string }> };

/** Zapisuje akceptację klienta (np. przy ladzie); portal klienta podłączy tę samą funkcję później. */
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId, "orders:write");
    return Response.json(await acceptProtocol(studioId, workOrderId));
  } catch (error) { return orderErrorResponse(error); }
}
