import { orderApiError, orderApiStudio } from "@/src/server/zlecenia/http";
import { getOrder } from "@/src/server/zlecenia/orders";

export async function GET(request: Request, context: { params: Promise<{ studioId: string; workOrderId: string }> }) {
  try {
    const { studioId, workOrderId } = await context.params;
    const { db } = await orderApiStudio(request, studioId, "orders:write");
    return Response.json(await getOrder(db, workOrderId));
  } catch (error) { return orderApiError(error); }
}
