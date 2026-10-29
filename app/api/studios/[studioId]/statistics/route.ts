import { apiError, apiStudio } from "@/src/server/http";
import { studioNow } from "@/src/server/pulpit/demo-clock";
import { getStudioStatistics, parseStatisticsRange } from "@/src/server/statystyki/statistics";

type Context = { params: Promise<{ studioId: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "stats:read");
    const params = new URL(request.url).searchParams;
    const range = parseStatisticsRange({ from: params.get("from"), to: params.get("to") }, await studioNow(studioId));
    return Response.json(await getStudioStatistics(studioId, range), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
