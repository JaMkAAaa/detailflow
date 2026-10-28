import { apiError, apiStudio } from "@/src/server/http";
import { searchQueryFromUrl, searchStudio } from "@/src/server/search/global";

export async function GET(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    const { studioId } = await context.params;
    const { member } = await apiStudio(request, studioId);
    return Response.json(await searchStudio(studioId, searchQueryFromUrl(request.url), member.role));
  } catch (error) {
    return apiError(error);
  }
}
