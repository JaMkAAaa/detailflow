import { createCheckout } from "@/src/server/billing/checkout";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";

export async function POST(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "billing:manage");
    return Response.json(await createCheckout(user.id, studioId, await request.json()));
  } catch (error) { return apiError(error); }
}
