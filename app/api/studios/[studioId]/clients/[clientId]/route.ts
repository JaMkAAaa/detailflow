import { apiStudio, checkOrigin } from "@/src/server/http";
import { deleteClient, getClient, updateClient } from "@/src/server/klienci/clients";
import { clientErrorResponse } from "@/src/server/klienci/errors";

type Context = { params: Promise<{ studioId: string; clientId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId, clientId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await getClient(studioId, clientId));
  } catch (error) { return clientErrorResponse(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, clientId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await updateClient(studioId, clientId, await request.json()));
  } catch (error) { return clientErrorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, clientId } = await context.params;
    await apiStudio(request, studioId);
    await deleteClient(studioId, clientId);
    return new Response(null, { status: 204 });
  } catch (error) { return clientErrorResponse(error); }
}
