import { z } from "zod";
import { platformDb } from "@/lib/db/client";
import { saveKsefToken } from "@/src/ksef/submissions";
import { apiError, apiStudio, checkOrigin } from "@/src/server/http";

const bodySchema = z.object({ token: z.string().trim().min(1).max(4096) }).strict();

export async function PUT(request: Request, context: { params: Promise<{ studioId: string }> }) {
  try {
    checkOrigin(request);
    const { studioId } = await context.params;
    const { user } = await apiStudio(request, studioId, "studio:settings");
    const { token } = bodySchema.parse(await request.json());
    await saveKsefToken(studioId, token);
    await platformDb.auditLog.create({
      data: { studioId, actorId: user.id, action: "studio.ksef.token", meta: { updated: true } },
    });
    return new Response(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
