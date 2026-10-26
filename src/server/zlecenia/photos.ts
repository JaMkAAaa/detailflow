import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { deleteObject, headObject, presignGet, presignPut } from "../../../lib/storage";
import { AccessError } from "../acl";
import { OrderError } from "./errors";

export const PHOTO_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" } as const;
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const UPLOAD_URL_TTL_S = 300;
export const VIEW_URL_TTL_S = 300;

export const photoUploadSchema = z.object({
  contentType: z.enum(Object.keys(PHOTO_EXTENSIONS) as [keyof typeof PHOTO_EXTENSIONS, ...(keyof typeof PHOTO_EXTENSIONS)[]], { error: "Dozwolone formaty: JPEG, PNG, WebP, HEIC." }),
  sizeBytes: z.number().int().min(1).max(MAX_PHOTO_BYTES, { error: "Zdjęcie może mieć maksymalnie 20 MB." }),
  stage: z.number().int().min(1).max(4).optional(), // domyślnie bieżący etap zlecenia
  caption: z.string().trim().min(1).max(200).optional(),
}).strict();
export const photoConfirmSchema = z.object({ key: z.string().min(1).max(512) }).strict();

const KEY_PATTERN = /^studios\/([^/]+)\/orders\/([^/]+)\/([A-Za-z0-9]+)\.(?:jpg|png|webp|heic)$/;

/** Prefix per studio: `studios/<studioId>/orders/<workOrderId>/<photoId>.<ext>`. */
export function photoKey(studioId: string, workOrderId: string, photoId: string, contentType: keyof typeof PHOTO_EXTENSIONS) {
  return `studios/${studioId}/orders/${workOrderId}/${photoId}.${PHOTO_EXTENSIONS[contentType]}`;
}

/** Klucz spoza prefiksu studia → 403 (zanim cokolwiek trafi do bazy lub S3). */
export function assertKeyInStudio(studioId: string, key: string) {
  if (!key.startsWith(`studios/${studioId}/`)) throw new AccessError(403, "Brak dostępu.");
  const match = KEY_PATTERN.exec(key);
  if (!match) throw new OrderError(400, "Nieprawidłowy klucz pliku.");
  return { workOrderId: match[2]! };
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const photoSelect = {
  id: true, no: true, stage: true, caption: true, contentType: true, sizeBytes: true,
  createdAt: true, uploadedAt: true, uploadedBy: { select: { id: true, name: true } },
} satisfies Prisma.OrderPhotoSelect;

/** Rezerwuje numer zdjęcia i wydaje podpisany PUT. Zdjęcie jest niewidoczne do `confirmPhotoUpload`. */
export async function requestPhotoUpload(studioId: string, workOrderId: string, userId: string, input: unknown) {
  const data = photoUploadSchema.parse(input);
  const db = studioDb(studioId);
  const order = await db.workOrder.findFirst({ where: { id: workOrderId }, select: { stage: true } });
  if (!order) throw new OrderError(404, "Nie znaleziono zlecenia.");

  for (let attempt = 0; ; attempt++) {
    const last = await db.orderPhoto.aggregate({ where: { workOrderId }, _max: { no: true } });
    const id = crypto.randomUUID().replaceAll("-", "");
    const key = photoKey(studioId, workOrderId, id, data.contentType);
    try {
      const photo = await db.orderPhoto.create({
        data: {
          id, studioId, workOrderId, key, no: (last._max.no ?? 0) + 1, stage: data.stage ?? order.stage,
          contentType: data.contentType, sizeBytes: data.sizeBytes, caption: data.caption ?? null, uploadedById: userId,
        },
        select: { id: true, no: true, stage: true },
      });
      const uploadUrl = await presignPut({ key, contentType: data.contentType, sizeBytes: data.sizeBytes, expiresIn: UPLOAD_URL_TTL_S });
      return {
        ...photo, key, uploadUrl, expiresIn: UPLOAD_URL_TTL_S,
        // Content-Type wchodzi do podpisu; długość ciała (podpisana) przeglądarka ustawia sama.
        headers: { "Content-Type": data.contentType },
      };
    } catch (error) {
      // Równoległe zdjęcia dostały ten sam numer: spróbuj z kolejnym.
      if (isUniqueViolation(error) && attempt < 5) continue;
      throw error;
    }
  }
}

/** Sprawdza, że plik naprawdę jest w S3 i ma zadeklarowany rozmiar/typ; dopiero wtedy zdjęcie staje się widoczne. */
export async function confirmPhotoUpload(studioId: string, workOrderId: string, input: unknown) {
  const { key } = photoConfirmSchema.parse(input);
  if (assertKeyInStudio(studioId, key).workOrderId !== workOrderId) throw new OrderError(404, "Nie znaleziono zdjęcia.");

  const db = studioDb(studioId);
  const photo = await db.orderPhoto.findFirst({ where: { key, workOrderId }, select: { ...photoSelect, key: true } });
  if (!photo) throw new OrderError(404, "Nie znaleziono zdjęcia.");
  if (photo.uploadedAt) return withUrl(photo); // idempotentnie

  const object = await headObject(key);
  if (!object) throw new OrderError(409, "Plik nie został wgrany.");
  if (object.sizeBytes !== photo.sizeBytes || object.contentType !== photo.contentType) {
    // Podmieniony plik nie zostaje w buckecie ani w liście zdjęć.
    await deleteObject(key);
    await db.orderPhoto.deleteMany({ where: { id: photo.id, uploadedAt: null } });
    throw new OrderError(400, "Wgrany plik nie zgadza się z zapowiedzianym rozmiarem lub typem.");
  }
  const updated = await db.orderPhoto.update({ where: { id: photo.id }, data: { uploadedAt: new Date() }, select: { ...photoSelect, key: true } });
  return withUrl(updated);
}

async function withUrl<T extends { key: string }>(photo: T) {
  const { key, ...rest } = photo;
  return { ...rest, url: await presignGet(key, VIEW_URL_TTL_S), urlExpiresIn: VIEW_URL_TTL_S };
}

export async function listPhotos(studioId: string, workOrderId: string) {
  const db = studioDb(studioId);
  if (!await db.workOrder.findFirst({ where: { id: workOrderId }, select: { id: true } })) throw new OrderError(404, "Nie znaleziono zlecenia.");
  const photos = await db.orderPhoto.findMany({
    where: { workOrderId, uploadedAt: { not: null } },
    select: { ...photoSelect, key: true }, orderBy: { no: "asc" },
  });
  return Promise.all(photos.map(withUrl));
}
