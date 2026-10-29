import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { documentError } from "@/src/server/faktury/document";
import { requestInvoiceMail } from "@/src/server/faktury/mail";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    return Response.json(await requestInvoiceMail(studioId, invoiceId, await request.json()), { status: 202 });
  } catch (error) { return documentError(error) ?? apiError(error); }
}
