import { apiError, apiStudio } from "@/src/server/http";
import { AccessError } from "@/src/server/acl";
import { invoiceDocument, documentError } from "@/src/server/faktury/document";
import { generateInvoicePdf } from "@/src/invoices/pdf";
import { generateFa3 } from "@/src/ksef/fa3";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string; format: string }> }) {
  try {
    const { studioId, invoiceId, format } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    const environment = new URL(request.url).searchParams.get("env");
    if ((environment !== "test" && environment !== "production") || !["pdf", "xml"].includes(format)) {
      throw new AccessError(400, "Wybierz format PDF/XML i środowisko TEST/PROD.");
    }
    const document = await invoiceDocument(studioId, invoiceId, environment);
    const body = format === "pdf" ? new Uint8Array(await generateInvoicePdf(document)) : generateFa3(document);
    const filename = `${document.invoice.number.replace(/[^a-zA-Z0-9-]/g, "-")}-${environment}.${format}`;
    return new Response(body, { headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return documentError(error) ?? apiError(error); }
}
