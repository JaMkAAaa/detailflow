import { checkOrigin } from "@/src/server/http";
import { orderApiError, orderApiStudio } from "@/src/server/zlecenia/http";
import { createOrder, listOrders } from "@/src/server/zlecenia/orders";

type Context = { params: Promise<{ studioId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    const { db } = await orderApiStudio(request, studioId, "orders:write");
    return Response.json(await listOrders(db));
  } catch (error) { return orderApiError(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { db, user } = await orderApiStudio(request, studioId, "orders:write");
    return Response.json(await createOrder(db, studioId, user.id, await request.json()), { status: 201 });
  } catch (error) { return orderApiError(error); }
}
