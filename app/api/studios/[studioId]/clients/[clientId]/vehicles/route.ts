import { apiStudio, checkOrigin } from "@/src/server/http";
import { createVehicle } from "@/src/server/klienci/clients";
import { clientErrorResponse } from "@/src/server/klienci/errors";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; clientId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, clientId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await createVehicle(studioId, clientId, await request.json()), { status: 201 });
  } catch (error) { return clientErrorResponse(error); }
}
