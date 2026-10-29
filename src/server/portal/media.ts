import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../../lib/env";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { VIEW_URL_TTL_S } from "../zlecenia/photos";

const PURPOSE = "portal-photo-v1";
const ID = /^[A-Za-z0-9]+$/;

function mac(linkId: string, photoId: string, exp: number) {
  const secret = env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET required");
  // Krótki podpis (128 bitów), osobny od surowego tokenu portalu.
  return createHmac("sha256", secret).update(`${PURPOSE}.${linkId}.${photoId}.${exp}`).digest().subarray(0, 16);
}

/** Ścieżka obrazka bez tokenu portalu i bez `studioId`. */
export function portalPhotoPath(linkId: string, photoId: string, now = Date.now()) {
  const exp = Math.floor(now / 1000) + VIEW_URL_TTL_S;
  const sig = mac(linkId, photoId, exp).toString("base64url");
  const query = new URLSearchParams({ l: linkId, e: String(exp), s: sig });
  return `/p/media/${encodeURIComponent(photoId)}?${query}`;
}

export function verifyPortalPhoto(linkId: string, photoId: string, exp: number, sig: string) {
  if (!ID.test(linkId) || !ID.test(photoId) || !Number.isSafeInteger(exp)) return false;
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return false;
  }
  const expected = mac(linkId, photoId, exp);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

/**
 * Zdjęcie linku zlecenia. `studioId` pochodzi z rekordu linku, nie z query.
 * Jedyny odczyt `platformDb`: granica auth po identyfikatorze linku związanym podpisem.
 */
export async function loadPortalPhoto(linkId: string, photoId: string) {
  const link = await platformDb.portalLink.findUnique({
    where: { id: linkId },
    select: { studioId: true, workOrderId: true, revokedAt: true, expiresAt: true },
  });
  if (!link?.workOrderId || link.revokedAt || link.expiresAt <= new Date()) return null;
  return studioDb(link.studioId).orderPhoto.findFirst({
    where: { id: photoId, workOrderId: link.workOrderId, uploadedAt: { not: null } },
    select: { key: true, contentType: true },
  });
}
