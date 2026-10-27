import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { markInvoicePaid } from "@/src/server/faktury/manage";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    const body = await request.text();
    return Response.json(await markInvoicePaid(studioId, invoiceId, body ? JSON.parse(body) : {}));
  } catch (error) { return apiError(error); }
}
