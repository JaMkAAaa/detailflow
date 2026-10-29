import { apiStudio, checkOrigin } from "@/src/server/http";
import { clientErrorResponse } from "@/src/server/klienci/errors";
import { eraseClientData, exportClientData } from "@/src/server/klienci/privacy";

type Context = { params: Promise<{ studioId: string; clientId: string }> };

// POST permits same-origin checks for both download and erasure, avoiding cached PII.
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, clientId } = await context.params;
    const { user } = await apiStudio(request, studioId, "clients:privacy");
    const body = await request.json();
    if (body?.action === "export") {
      return Response.json(await exportClientData(studioId, clientId, user.id), { headers: {
        "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="client-data.json"',
      } });
    }
    if (body?.action === "erase") {
      return Response.json(await eraseClientData(studioId, clientId, user.id), { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Nieprawidłowa akcja." }, { status: 400 });
  } catch (error) { return clientErrorResponse(error); }
}
