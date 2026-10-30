import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { documentError } from "@/src/server/faktury/document";
import { exportJpk } from "@/src/server/faktury/jpk";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    const { xml, filename } = await exportJpk(studioId, await request.json());
    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { const response = documentError(error) ?? apiError(error); response.headers.set("Cache-Control", "no-store"); return response; }
}
