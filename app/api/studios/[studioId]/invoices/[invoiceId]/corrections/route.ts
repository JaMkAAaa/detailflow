import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { correctInvoice } from "@/src/server/faktury/manage";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    return Response.json(await correctInvoice(studioId, invoiceId, await request.json()), { status: 201 });
  } catch (error) { return apiError(error); }
}
