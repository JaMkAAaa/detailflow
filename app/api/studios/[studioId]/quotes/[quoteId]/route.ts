import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { saveQuote } from "@/src/server/wyceny/send";
import { Prisma } from "@/lib/db/generated/client";

type Context = { params: Promise<{ studioId: string; quoteId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { studioId, quoteId } = await context.params;
    const { db } = await apiStudio(request, studioId, "quotes:write");
    const quote = await db.quote.findFirst({ where: { id: quoteId }, include: { items: { orderBy: { sort: "asc" } } } });
    return quote ? Response.json(quote) : Response.json({ error: "Nie znaleziono wyceny." }, { status: 404 });
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, quoteId } = await context.params;
    const { user } = await apiStudio(request, studioId, "quotes:write");
    return Response.json(await saveQuote(studioId, quoteId, await request.json(), user.id));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
      return Response.json({ error: "Wycena została zmieniona równolegle. Ponów zapis." }, { status: 409 });
    }
    return apiError(error);
  }
}
