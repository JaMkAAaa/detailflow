import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { assertDerivativeKey, derivativeKey, publishInputSchema, PUBLIC_DERIVATIVE_TYPE } from "../../../lib/portfolio/rules";
import { deleteObject, openObject, presignGet, putObject } from "../../../lib/storage";
import { VIEW_URL_TTL_S } from "../zlecenia/photos";
import { PortfolioError } from "./errors";
import { renderPublicDerivative } from "./mask";

const PAGE = 48;

async function readBytes(key: string) {
  const object = await openObject(key);
  if (!object) return null;
  return Buffer.from(await new Response(object.stream).arrayBuffer());
}

async function deleteDerivative(studioId: string, key: string | null) {
  if (!key) return;
  assertDerivativeKey(studioId, key);
  await deleteObject(key);
}

function maskOf(photo: { maskX: number | null; maskY: number | null; maskW: number | null; maskH: number | null }) {
  if (photo.maskX === null || photo.maskY === null || photo.maskW === null || photo.maskH === null) return null;
  return { x: photo.maskX, y: photo.maskY, w: photo.maskW, h: photo.maskH };
}

/** Potwierdzone zdjęcia studia do ręcznej decyzji. Podgląd to krótki podpis oryginału — tylko dla zalogowanego zespołu. */
export async function listPortfolio(studioId: string) {
  const db = studioDb(studioId);
  const where = { uploadedAt: { not: null } };
  const [total, photos] = await Promise.all([
    db.orderPhoto.count({ where }),
    db.orderPhoto.findMany({
      where,
      orderBy: [{ uploadedAt: "desc" }, { id: "asc" }],
      take: PAGE,
      select: {
        id: true, no: true, caption: true, key: true, publishedAt: true, plateVisible: true,
        maskX: true, maskY: true, maskW: true, maskH: true,
        workOrder: { select: {
          number: true, service: true,
          client: { select: { name: true } },
          vehicle: { select: { make: true, model: true, plate: true } },
        } },
      },
    }),
  ]);
  return {
    truncated: total > PAGE,
    photos: await Promise.all(photos.map(async (photo) => ({
      id: photo.id,
      no: photo.no,
      caption: photo.caption,
      published: photo.publishedAt !== null,
      plateVisible: photo.plateVisible,
      mask: maskOf(photo),
      previewUrl: await presignGet(photo.key, VIEW_URL_TTL_S),
      urlExpiresIn: VIEW_URL_TTL_S,
      make: photo.workOrder.vehicle.make,
      model: photo.workOrder.vehicle.model,
      plate: photo.workOrder.vehicle.plate,
      service: photo.workOrder.service,
      clientName: photo.workOrder.client.name,
      orderNumber: photo.workOrder.number,
    }))),
  };
}

/** Świadoma publikacja. Bez `plateVisible: true` wymaga obszaru maski i nigdy nie wystawia oryginału. */
export async function publishPhoto(studioId: string, photoId: string, actorId: string, input: unknown) {
  const data = publishInputSchema.parse(input);
  const db = studioDb(studioId);
  const photo = await db.orderPhoto.findFirst({
    where: { id: photoId, uploadedAt: { not: null } },
    select: { id: true, key: true, publicKey: true, publicVersion: true },
  });
  if (!photo) throw new PortfolioError(404, "Nie znaleziono zdjęcia.");

  const original = await readBytes(photo.key);
  if (!original) throw new PortfolioError(409, "Plik zdjęcia nie jest w magazynie.");

  let derivative: Buffer;
  try {
    derivative = await renderPublicDerivative(original, { plateVisible: data.plateVisible, mask: data.mask });
  } catch {
    throw new PortfolioError(400, "Nie udało się przygotować publicznej wersji. Oryginał zostaje prywatny i nic nie zostało opublikowane.");
  }
  if (derivative.equals(original)) {
    throw new PortfolioError(400, "Nie udało się przygotować publicznej wersji. Oryginał zostaje prywatny i nic nie zostało opublikowane.");
  }

  const version = photo.publicVersion + 1;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const publicKey = derivativeKey(studioId, photo.id, version, nonce);
  await putObject(publicKey, derivative, PUBLIC_DERIVATIVE_TYPE);
  const mask = data.plateVisible ? null : data.mask ?? null;
  const updated = await db.orderPhoto.updateMany({
    where: { id: photo.id, publicVersion: photo.publicVersion },
    data: {
      publishedAt: new Date(),
      plateVisible: data.plateVisible,
      maskX: mask?.x ?? null,
      maskY: mask?.y ?? null,
      maskW: mask?.w ?? null,
      maskH: mask?.h ?? null,
      publicKey,
      publicVersion: version,
    },
  });
  if (!updated.count) {
    await deleteDerivative(studioId, publicKey);
    throw new PortfolioError(409, "Zdjęcie zmieniło się w międzyczasie. Odśwież i spróbuj ponownie.");
  }
  if (photo.publicKey && photo.publicKey !== publicKey) await deleteDerivative(studioId, photo.publicKey);
  await platformDb.auditLog.create({
    data: { studioId, actorId, action: "portfolio.publish", meta: { photoId: photo.id, plateVisible: data.plateVisible } },
  });
  return { id: photo.id, published: true, plateVisible: data.plateVisible, publicVersion: version };
}

/** Zdejmuje publikację także przy wstrzymanym abonamencie. Kasuje pochodną, oryginału nie rusza. */
export async function unpublishPhoto(studioId: string, photoId: string, actorId: string) {
  const db = studioDb(studioId);
  const photo = await db.orderPhoto.findFirst({
    where: { id: photoId },
    select: { id: true, publicKey: true, publicVersion: true, publishedAt: true },
  });
  if (!photo) throw new PortfolioError(404, "Nie znaleziono zdjęcia.");
  if (!photo.publishedAt && !photo.publicKey) return { id: photo.id, published: false };

  const updated = await db.orderPhoto.updateMany({
    where: { id: photo.id, publicVersion: photo.publicVersion },
    data: { publishedAt: null, publicKey: null, plateVisible: false, publicVersion: { increment: 1 } },
  });
  if (!updated.count) throw new PortfolioError(409, "Zdjęcie zmieniło się w międzyczasie. Odśwież i spróbuj ponownie.");
  await deleteDerivative(studioId, photo.publicKey);
  await platformDb.auditLog.create({
    data: { studioId, actorId, action: "portfolio.unpublish", meta: { photoId: photo.id } },
  });
  return { id: photo.id, published: false };
}
