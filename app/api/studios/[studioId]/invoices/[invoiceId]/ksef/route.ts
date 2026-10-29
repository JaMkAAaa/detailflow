import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { queueKsefInvoice } from "@/src/ksef/submissions";
import { prepareInvoiceXml } from "@/src/server/faktury/ksef";
import { documentError } from "@/src/server/faktury/document";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    await queueKsefInvoice(studioId, invoiceId, prepareInvoiceXml);
    return Response.json({ ksefStatus: "queued" }, { status: 202 });
  } catch (error) { return documentError(error) ?? apiError(error); }
}
