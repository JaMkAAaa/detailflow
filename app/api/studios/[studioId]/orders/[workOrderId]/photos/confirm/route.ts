import { apiStudio, checkOrigin } from "@/src/server/http";
import { orderErrorResponse } from "@/src/server/zlecenia/errors";
import { confirmPhotoUpload } from "@/src/server/zlecenia/photos";

type Context = { params: Promise<{ studioId: string; workOrderId: string }> };

/** Klient woła po udanym PUT; `key` spoza studia → 403. */
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId, "orders:write");
    return Response.json(await confirmPhotoUpload(studioId, workOrderId, await request.json()));
  } catch (error) { return orderErrorResponse(error); }
}
