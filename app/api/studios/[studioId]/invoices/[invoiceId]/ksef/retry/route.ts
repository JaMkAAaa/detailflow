import { z } from "zod";
import { validNip } from "@/components/faktury/model";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { retryKsefInvoice } from "@/src/ksef/submissions";
import { documentError } from "@/src/server/faktury/document";
const input = z.object({ buyerNip: z.string().transform(value => value.replace(/[ -]/g, "")).refine(validNip).optional() }).strict();
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ studioId: string; invoiceId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, invoiceId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    const body = input.parse(await request.json());
    await retryKsefInvoice(studioId, invoiceId, body.buyerNip);
    return Response.json({ ksefStatus: "queued" }, { status: 202 });
  } catch (error) { return documentError(error) ?? apiError(error); }
}
