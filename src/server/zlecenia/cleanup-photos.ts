import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { deleteObject } from "../../../lib/storage";

export const UNCONFIRMED_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;

/** Bounded sweep; confirmed photos have no automatic retention policy. */
export async function cleanupUnconfirmedPhotos(now = new Date()) {
  const studios = await platformDb.studio.findMany({ select: { id: true } });
  const stale = { uploadedAt: null, createdAt: { lt: new Date(now.getTime() - UNCONFIRMED_PHOTO_TTL_MS) } };
  let deleted = 0;
  for (const { id: studioId } of studios) {
    const db = studioDb(studioId);
    const photos = await db.orderPhoto.findMany({
      where: stale, select: { id: true, key: true }, orderBy: { createdAt: "asc" }, take: 100,
    });
    for (const photo of photos) {
      deleted += await db.$transaction(async (tx) => {
        // A no-op UPDATE locks the row and rechecks eligibility after concurrent confirmation.
        const locked = await tx.orderPhoto.updateMany({ where: { id: photo.id, ...stale }, data: { uploadedAt: null } });
        if (!locked.count) return 0;
        if (!photo.key.startsWith(`studios/${studioId}/orders/`)) throw new Error("Photo key outside studio");
        // S3 DELETE is idempotent, including a missing object. On failure keep the row for retry.
        await deleteObject(photo.key);
        return (await tx.orderPhoto.deleteMany({ where: { id: photo.id, ...stale } })).count;
      });
    }
  }
  return deleted;
}
