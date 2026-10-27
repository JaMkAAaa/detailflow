import { createBillingPortal } from "@/src/server/billing/portal";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "billing:manage");
    return Response.json(await createBillingPortal(user.id, studioId));
  } catch (error) { return apiError(error); }
}
