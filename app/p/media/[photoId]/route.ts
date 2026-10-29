import { openObject } from "@/lib/storage";
import { loadPortalPhoto, verifyPortalPhoto } from "@/src/server/portal/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const missing = () => new Response(null, { status: 404, headers: PRIVATE });

/** Podgląd zdjęcia zlecenia. Nie przyjmuje `studioId` z query i nie zna tokenu portalu. */
export async function GET(request: Request, context: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await context.params;
  const url = new URL(request.url);
  // `studioId` z query nie jest czytane. Studio bierze się z rekordu linku.
  const linkId = url.searchParams.get("l") ?? "";
  const exp = Number(url.searchParams.get("e"));
  const sig = url.searchParams.get("s") ?? "";
  if (!verifyPortalPhoto(linkId, photoId, exp, sig) || exp * 1000 <= Date.now()) return missing();
  const photo = await loadPortalPhoto(linkId, photoId);
  if (!photo) return missing();
  const object = await openObject(photo.key);
  if (!object) return missing();
  const headers = new Headers(PRIVATE);
  headers.set("Content-Type", photo.contentType);
  headers.set("Content-Disposition", "inline");
  headers.set("X-Robots-Tag", "noindex");
  if (typeof object.contentLength === "number") headers.set("Content-Length", String(object.contentLength));
  return new Response(object.stream, { headers });
}
