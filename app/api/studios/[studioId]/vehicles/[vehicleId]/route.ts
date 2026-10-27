import { apiStudio, checkOrigin } from "@/src/server/http";
import { deleteVehicle, updateVehicle } from "@/src/server/klienci/clients";
import { clientErrorResponse } from "@/src/server/klienci/errors";

type Context = { params: Promise<{ studioId: string; vehicleId: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, vehicleId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await updateVehicle(studioId, vehicleId, await request.json()));
  } catch (error) { return clientErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, vehicleId } = await context.params;
    await apiStudio(request, studioId);
    await deleteVehicle(studioId, vehicleId);
    return new Response(null, { status: 204 });
  } catch (error) { return clientErrorResponse(error); }
}
