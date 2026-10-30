import { z } from "zod";
import { auth } from "@/lib/auth";
import { platformDb } from "@/lib/db/client";
import { apiError, checkOrigin, limitApiWrite } from "@/src/server/http";

const preferences = z.object({ trialReminderEnabled: z.boolean() }).strict();

export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return Response.json({ error: "Zaloguj się." }, { status: 401 });
    await limitApiWrite(request, session.user.id);
    const data = preferences.parse(await request.json());
    // Preferencja tożsamości: żadnego userId/studioId z żądania ani bramki abonamentu.
    await platformDb.user.update({ where: { id: session.user.id }, data });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
