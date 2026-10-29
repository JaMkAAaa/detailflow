import { z } from "zod";

/** Ułamek szerokości i wysokości kadru. Mniejszy prostokąt zostawiłby znaki tablicy. */
export const MASK_MIN_W = 0.05;
export const MASK_MIN_H = 0.04;
export const PUBLIC_DERIVATIVE_TYPE = "image/jpeg";
/** Współdzielony cache musi odpytać serwer, zanim pokaże pochodną. Odpublikowanie widać przy następnym żądaniu. */
export const PUBLIC_MEDIA_CACHE = "public, max-age=0, must-revalidate";
export const PRIVATE_NO_STORE = "private, no-store";

const maskRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite(),
  h: z.number().finite(),
}).strict();

export type MaskRect = z.infer<typeof maskRectSchema>;

function sum(a: number, b: number) {
  return Math.round((a + b) * 1_000_000) / 1_000_000;
}

export function maskError(mask: MaskRect): string | null {
  if (mask.x < 0 || mask.y < 0 || mask.x >= 1 || mask.y >= 1) return "Obszar maski musi leżeć na zdjęciu.";
  if (!(mask.w > 0 && mask.h > 0) || sum(mask.x, mask.w) > 1 || sum(mask.y, mask.h) > 1) return "Obszar maski musi leżeć na zdjęciu.";
  if (mask.w < MASK_MIN_W || mask.h < MASK_MIN_H) return "Zaznacz większy obszar tablicy. Za mała maska zostawiłaby znaki widoczne.";
  return null;
}

export const publishInputSchema = z.object({
  plateVisible: z.boolean(),
  mask: maskRectSchema.optional(),
}).strict().superRefine((value, ctx) => {
  if (value.plateVisible) return;
  if (!value.mask) {
    ctx.addIssue({
      code: "custom",
      message: "Domyślnie tablica jest maskowana. Zaznacz jej obszar albo świadomie zostaw ją widoczną.",
      path: ["mask"],
    });
    return;
  }
  const error = maskError(value.mask);
  if (error) ctx.addIssue({ code: "custom", message: error, path: ["mask"] });
});

export function isPublicSlug(slug: string) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(slug) && !slug.includes("..");
}

export function isPhotoId(id: string) {
  return /^[A-Za-z0-9]{8,64}$/.test(id);
}

export function derivativeKey(studioId: string, photoId: string, version: number, nonce: string) {
  if (studioId.includes("/") || studioId.includes("..") || !isPhotoId(photoId) || !Number.isSafeInteger(version) || version < 1 || !/^[a-f0-9]{32}$/.test(nonce)) {
    throw new Error("Nieprawidłowy klucz publicznej pochodnej.");
  }
  return `studios/${studioId}/portfolio/${photoId}/v${version}-${nonce}.jpg`;
}

/** Rzuca, zanim ktokolwiek usunie oryginał albo klucz innego studia. */
export function assertDerivativeKey(studioId: string, key: string) {
  const prefix = `studios/${studioId}/portfolio/`;
  if (studioId.includes("/") || studioId.includes("..") || !key.startsWith(prefix) || key.includes("..") || key.includes("/orders/")) {
    throw new Error("Odmowa usunięcia klucza, który nie jest publiczną pochodną.");
  }
}
