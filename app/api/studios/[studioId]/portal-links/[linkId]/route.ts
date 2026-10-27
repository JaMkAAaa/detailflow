import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { revokePortalLink } from "@/src/server/portal/links";

export async function DELETE(request: Request, context: { params: Promise<{ studioId: string; linkId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, linkId } = await context.params;
    const { db } = await apiStudio(request, studioId, "orders:update");
    await revokePortalLink(db, linkId);
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
