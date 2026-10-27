import { z } from "zod";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { createPortalLink, PortalLinkError } from "@/src/server/portal/links";

const schema = z.union([
  z.object({ quoteId: z.string().min(1) }).strict(),
  z.object({ workOrderId: z.string().min(1) }).strict(),
]);
export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { db } = await apiStudio(request, studioId, "orders:update");
    const link = await createPortalLink(db, studioId, schema.parse(await request.json()));
    return Response.json(link, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PortalLinkError) return Response.json({ error: error.message }, { status: 404 });
    return apiError(error);
  }
}
