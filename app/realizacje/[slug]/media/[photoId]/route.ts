import { PRIVATE_NO_STORE, PUBLIC_DERIVATIVE_TYPE, PUBLIC_MEDIA_CACHE } from "@/lib/portfolio/rules";
import { openObject } from "@/lib/storage";
import { loadPublicDerivative } from "@/src/server/portfolio/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const common = { "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const missing = () => new Response(null, { status: 404, headers: { ...common, "Cache-Control": PRIVATE_NO_STORE } });

/** Strumień publicznej pochodnej. Nie podpisuje oryginału i nie przekierowuje do S3. */
export async function GET(request: Request, context: { params: Promise<{ slug: string; photoId: string }> }) {
  const { slug, photoId } = await context.params;
  const photo = await loadPublicDerivative(slug, photoId);
  if (!photo) return missing();
  const etag = `"v${photo.publicVersion}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...common, ETag: etag, "Cache-Control": PUBLIC_MEDIA_CACHE } });
  }
  const object = await openObject(photo.publicKey);
  if (!object) return missing();
  const headers = new Headers({ ...common, "Cache-Control": PUBLIC_MEDIA_CACHE, ETag: etag });
  headers.set("Content-Type", PUBLIC_DERIVATIVE_TYPE);
  headers.set("Content-Disposition", "inline");
  headers.set("X-Robots-Tag", "noindex");
  if (typeof object.contentLength === "number") headers.set("Content-Length", String(object.contentLength));
  return new Response(object.stream, { headers });
}
