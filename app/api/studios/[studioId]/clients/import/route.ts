import { apiStudio, checkOrigin } from "@/src/server/http";
import { importClientsCsv } from "@/src/server/klienci/clients";
import { readCsvBody } from "@/src/server/klienci/csv";
import { clientErrorResponse } from "@/src/server/klienci/errors";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await importClientsCsv(studioId, await readCsvBody(request)));
  } catch (error) { return clientErrorResponse(error); }
}
