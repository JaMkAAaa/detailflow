import { AccessError } from "@/src/server/acl";
import { apiError, apiStudio } from "@/src/server/http";

export async function GET(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    const { studioId, invoiceId } = await context.params;
    const { db } = await apiStudio(request, studioId, "invoices:manage");
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
    return Response.json(invoice);
  } catch (error) { return apiError(error); }
}
