import { ZodError } from "zod";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { BookingError, deleteBooking, getBooking, saveBooking } from "@/src/server/kalendarz/booking";

type Context = { params: Promise<{ studioId: string; workOrderId: string }> };
function errorResponse(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? "Nieprawidłowe dane." }, { status: 400 });
  if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
  return apiError(error);
}
export async function GET(request: Request, context: Context) {
  try {
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await getBooking(studioId, workOrderId));
  } catch (error) { return errorResponse(error); }
}
async function save(request: Request, context: Context, mode: "create" | "update") {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId);
    return Response.json(await saveBooking(studioId, workOrderId, await request.json(), mode), { status: mode === "create" ? 201 : 200 });
  } catch (error) { return errorResponse(error); }
}
export const POST = (request: Request, context: Context) => save(request, context, "create");
export const PUT = (request: Request, context: Context) => save(request, context, "update");
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, workOrderId } = await context.params;
    await apiStudio(request, studioId);
    await deleteBooking(studioId, workOrderId);
    return new Response(null, { status: 204 });
  } catch (error) { return errorResponse(error); }
}
