import { apiStudio, checkOrigin } from "@/src/server/http";
import { importClientsCsv, importClientsXlsx } from "@/src/server/klienci/clients";
import { readClientImportBody } from "@/src/server/klienci/csv";
import { clientErrorResponse } from "@/src/server/klienci/errors";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    const body = await readClientImportBody(request);
    const result = body.format === "xlsx"
      ? await importClientsXlsx(studioId, body.data)
      : await importClientsCsv(studioId, body.data);
    return Response.json(result);
  } catch (error) { return clientErrorResponse(error); }
}
