import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { invoiceSeller } from "@/src/server/faktury/query";
import { issueInvoice } from "@/src/server/faktury/manage";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "invoices:manage");
    // Środowisko KSeF pochodzi z konfiguracji studia, nie z żądania: TEST nie trafi na PROD przypadkiem.
    const { env } = await invoiceSeller(studioId, user.id);
    return Response.json(await issueInvoice(studioId, env, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
