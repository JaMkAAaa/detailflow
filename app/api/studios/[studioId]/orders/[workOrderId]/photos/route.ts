import { apiStudio, checkOrigin } from "@/src/server/http";
import { orderErrorResponse } from "@/src/server/zlecenia/errors";
import { listPhotos, requestPhotoUpload } from "@/src/server/zlecenia/photos";

type Context = { params: Promise<{ studioId: string; workOrderId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await listPhotos(studioId, workOrderId));
  } catch (error) { return orderErrorResponse(error); }
}

/** Rezerwuje zdjęcie i zwraca podpisany PUT do S3. */
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    const { user } = await apiStudio(request, studioId, "orders:write");
    return Response.json(await requestPhotoUpload(studioId, workOrderId, user.id, await request.json()), { status: 201 });
  } catch (error) { return orderErrorResponse(error); }
}
