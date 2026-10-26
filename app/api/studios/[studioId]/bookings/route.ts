import { apiError, apiStudio } from "@/src/server/http";
import { listBookings } from "@/src/server/kalendarz/booking";

export async function GET(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    const { studioId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await listBookings(studioId));
  } catch (error) { return apiError(error); }
}
