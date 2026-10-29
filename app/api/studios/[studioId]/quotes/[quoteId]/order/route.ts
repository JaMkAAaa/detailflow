import { checkOrigin } from "@/src/server/http";
import { orderApiError, orderApiStudio } from "@/src/server/zlecenia/http";
import { createOrder } from "@/src/server/zlecenia/orders";

type Context = { params: Promise<{ studioId: string; quoteId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, quoteId } = await context.params;
    const { db, user } = await orderApiStudio(request, studioId, "quotes:write");
    return Response.json(await createOrder(db, studioId, user.id, await request.json(), quoteId));
  } catch (error) { return orderApiError(error); }
}
