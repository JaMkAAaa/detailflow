import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { assertDerivativeKey, isPhotoId, isPublicSlug } from "../../../lib/portfolio/rules";

const PAGE = 100;

/**
 * Publiczna galeria. Jedyny odczyt platformy to studio po jawnym slugu.
 * Dalej wyłącznie `studioDb`. Wynik nie ma danych klienta, tablicy, klucza S3 ani podpisu.
 */
export async function loadPublicPortfolio(slug: string) {
  if (!isPublicSlug(slug)) return null;
  const studio = await platformDb.studio.findUnique({
    where: { slug },
    select: { id: true, name: true, city: true },
  });
  if (!studio) return null;
  const photos = await studioDb(studio.id).orderPhoto.findMany({
    where: { publishedAt: { not: null }, publicKey: { not: null } },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: PAGE,
    select: {
      id: true,
      publicVersion: true,
      workOrder: { select: { service: true, vehicle: { select: { make: true, model: true } } } },
    },
  });
  return {
    studio: { name: studio.name, city: studio.city },
    items: photos.map((photo) => ({
      id: photo.id,
      make: photo.workOrder.vehicle.make,
      model: photo.workOrder.vehicle.model,
      service: photo.workOrder.service,
      src: `/realizacje/${encodeURIComponent(slug)}/media/${photo.id}?v=${photo.publicVersion}`,
    })),
  };
}

/** Pochodna do strumienia. Nie zwraca klucza oryginału. Cudze `studioId` z query nie ma tu wejścia. */
export async function loadPublicDerivative(slug: string, photoId: string) {
  if (!isPublicSlug(slug) || !isPhotoId(photoId)) return null;
  const studio = await platformDb.studio.findUnique({ where: { slug }, select: { id: true } });
  if (!studio) return null;
  const photo = await studioDb(studio.id).orderPhoto.findFirst({
    where: { id: photoId, publishedAt: { not: null }, publicKey: { not: null } },
    select: { publicKey: true, publicVersion: true },
  });
  if (!photo?.publicKey) return null;
  assertDerivativeKey(studio.id, photo.publicKey);
  return { publicKey: photo.publicKey, publicVersion: photo.publicVersion };
}
