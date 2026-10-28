import { checkOrigin } from "@/src/server/http";
import { orderApiError, orderApiStudio } from "@/src/server/zlecenia/http";
import { advanceStage } from "@/src/server/zlecenia/state";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; workOrderId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    const { db, user } = await orderApiStudio(request, studioId, "orders:update");
    return Response.json(await advanceStage(db, { orderId: workOrderId, actorId: user.id }));
  } catch (error) { return orderApiError(error); }
}
