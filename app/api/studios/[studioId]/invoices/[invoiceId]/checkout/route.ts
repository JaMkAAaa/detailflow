import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { createInvoiceCheckout, expireInvoiceCheckout } from "@/src/server/client-payments/checkout";
async function run(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }, expire: boolean) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    // Body nie jest źródłem customer, odbiorcy ani ceny; parametry są wyłącznie z bazy.
    if ((await request.text()).trim()) return Response.json({ error: "Nie podawaj danych płatności." }, { status: 400 });
    return Response.json(await (expire ? expireInvoiceCheckout : createInvoiceCheckout)(studioId, invoiceId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export const POST = (request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) => run(request, context, false);
export const DELETE = (request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) => run(request, context, true);
