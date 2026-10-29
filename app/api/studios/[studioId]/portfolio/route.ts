import { apiStudio } from "@/src/server/http";
import { portfolioErrorResponse } from "@/src/server/portfolio/errors";
import { listPortfolio } from "@/src/server/portfolio/publish";

type Context = { params: Promise<{ studioId: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await listPortfolio(studioId));
  } catch (error) { return portfolioErrorResponse(error); }
}
