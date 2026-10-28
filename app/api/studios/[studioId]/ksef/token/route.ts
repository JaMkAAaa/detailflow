import { z } from "zod";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";
import { saveKsefToken } from "@/src/ksef/submissions";

export async function PUT(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    await apiStudio(request, studioId, "invoices:manage");
    const { token } = z.object({ token: z.string().trim().min(1).max(4096) }).strict().parse(await request.json());
    await saveKsefToken(studioId, token);
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
