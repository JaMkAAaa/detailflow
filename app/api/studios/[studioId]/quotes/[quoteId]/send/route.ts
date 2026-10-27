import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { sendQuote } from "@/src/server/wyceny/send";

type Context = { params: Promise<{ studioId: string; quoteId: string }> };
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, quoteId } = await context.params;
    await apiStudio(request, studioId, "quotes:write");
    return Response.json(await sendQuote(studioId, quoteId), { status: 202 });
  } catch (error) { return apiError(error); }
}
