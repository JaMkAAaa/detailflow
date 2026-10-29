import { auth } from "@/lib/auth";
import { AccessError, authorizeStudio } from "@/src/server/acl";
import { apiStudio, checkOrigin, limitApiWrite } from "@/src/server/http";
import { portfolioErrorResponse } from "@/src/server/portfolio/errors";
import { publishPhoto, unpublishPhoto } from "@/src/server/portfolio/publish";

type Context = { params: Promise<{ studioId: string; photoId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, photoId } = await context.params;
    const { user } = await apiStudio(request, studioId, "portfolio:manage");
    return Response.json(await publishPhoto(studioId, photoId, user.id, await request.json()));
  } catch (error) { return portfolioErrorResponse(error); }
}

/** Zdjęcie publikacji. Działa także przy wstrzymanym abonamencie — to nie jest nowy zapis marketingowy. */
export async function DELETE(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { studioId, photoId } = await context.params;
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw new AccessError(401, "Zaloguj się.");
    await authorizeStudio(session.user.id, studioId, "portfolio:manage", false);
    await limitApiWrite(request, session.user.id);
    return Response.json(await unpublishPhoto(studioId, photoId, session.user.id));
  } catch (error) { return portfolioErrorResponse(error); }
}
