import { apiStudio, checkOrigin } from "@/src/server/http";
import { createClient, listClients, parseListQuery } from "@/src/server/klienci/clients";
import { clientErrorResponse } from "@/src/server/klienci/errors";

type Context = { params: Promise<{ studioId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await listClients(studioId, parseListQuery(request.url)));
  } catch (error) { return clientErrorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await createClient(studioId, await request.json()), { status: 201 });
  } catch (error) { return clientErrorResponse(error); }
}
