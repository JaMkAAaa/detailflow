import { checkOrigin } from "@/src/server/http";
import { orderApiError, orderApiStudio } from "@/src/server/zlecenia/http";
import { orderStatusSchema } from "@/src/server/zlecenia/orders";
import { transitionOrder } from "@/src/server/zlecenia/state";

export async function POST(request: Request, context: { params: Promise<{ studioId: string; workOrderId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    const { db, user } = await orderApiStudio(request, studioId, "orders:update");
    const { status } = orderStatusSchema.parse(await request.json());
    return Response.json(await transitionOrder(db, { orderId: workOrderId, actorId: user.id, to: status }));
  } catch (error) { return orderApiError(error); }
}
