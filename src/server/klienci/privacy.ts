import { platformDb } from "../../../lib/db/client";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { deleteObject } from "../../../lib/storage";
import { ClientError } from "./errors";
import { UPLOAD_URL_TTL_S } from "../zlecenia/photos";

const missing = () => new ClientError(404, "Nie znaleziono klienta.");

/** Explicit allowlist: neither bearer tokens nor their hashes/storage keys leave this API. */
export async function exportClientData(studioId: string, clientId: string, actorId: string) {
  const db = studioDb(studioId);
  const result = await db.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: clientId }, select: {
      id: true, name: true, email: true, phone: true, street: true, postal: true, city: true,
      nip: true, isRegular: true, createdAt: true,
    } });
    if (!client) throw missing();
    const vehicles = await tx.vehicle.findMany({ where: { clientId }, select: {
      id: true, make: true, model: true, plate: true, year: true, color: true, size: true, createdAt: true,
    } });
    const orders = await tx.workOrder.findMany({ where: { clientId }, select: {
      id: true, number: true, vehicleId: true, status: true, stage: true, service: true,
      scheduledFrom: true, scheduledTo: true, dueAt: true, completedAt: true, createdAt: true, totalGross: true,
    } });
    const quotes = await tx.quote.findMany({ where: { clientId }, select: {
      id: true, vehicleId: true, status: true, notes: true, totalGross: true, vatAmount: true,
      createdAt: true, sentAt: true, decidedAt: true,
      items: { select: { name: true, basePrice: true, durationMin: true, sort: true } },
    } });
    const portalLinks = await tx.portalLink.findMany({ where: { OR: [
      { workOrderId: { in: orders.map((o) => o.id) } }, { quoteId: { in: quotes.map((q) => q.id) } },
    ] }, select: { id: true, workOrderId: true, quoteId: true, createdAt: true, expiresAt: true, revokedAt: true } });
    return { client, vehicles, orders, quotes, portalLinks };
  }, { isolationLevel: "RepeatableRead" });
  await platformDb.auditLog.create({ data: { studioId, actorId, action: "client.privacy.export", meta: { clientId } } });
  return result;
}

/**
 * Preserve accounting snapshots and accepted protocol content. There is no customer
 * signature/contact snapshot on IntakeProtocol; it resolves the anonymized Client.
 * S3 failures retain DB rows for an idempotent retry (S3 itself is not transactional).
 */
export async function eraseClientData(studioId: string, clientId: string, actorId: string) {
  const db = studioDb(studioId);
  // Record the attempt before touching S3, also when a partial external delete fails.
  await platformDb.auditLog.create({ data: { studioId, actorId, action: "client.privacy.erase.request", meta: { clientId } } });
  const result = await db.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: clientId }, select: { id: true } });
    if (!client) throw missing();
    const orders = await tx.workOrder.findMany({ where: { clientId }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    const quotes = await tx.quote.findMany({ where: { clientId }, select: { id: true } });
    const quoteIds = quotes.map((q) => q.id);
    const photos = await tx.orderPhoto.findMany({ where: { workOrderId: { in: orderIds } }, select: { id: true, key: true, createdAt: true } });
    // A still-valid presigned PUT could recreate a deleted S3 object after its row is gone.
    const safeBefore = Date.now() - (UPLOAD_URL_TTL_S + 60) * 1000;
    if (photos.some((photo) => photo.createdAt.getTime() > safeBefore)) {
      throw new ClientError(409, "Niedawno wydano link do przesłania zdjęcia. Ponów usunięcie za 6 minut.");
    }
    for (const photo of photos) {
      if (!photo.key.startsWith(`studios/${studioId}/orders/`)) throw new Error("Photo key outside studio");
      await deleteObject(photo.key);
    }
    // Only the attachment reference changes, never an accepted protocol's content or acceptance.
    await tx.intakeDamage.updateMany({ where: { photoId: { in: photos.map((p) => p.id) } }, data: { photoId: null } });
    await tx.orderPhoto.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });
    await tx.portalLink.updateMany({ where: { revokedAt: null, OR: [
      { workOrderId: { in: orderIds } }, { quoteId: { in: quoteIds } },
    ] }, data: { revokedAt: new Date() } });
    await tx.quoteSendMail.deleteMany({ where: { quoteId: { in: quoteIds }, sentAt: null } });
    await tx.quoteDecisionMail.deleteMany({ where: { quoteId: { in: quoteIds }, sentAt: null } });
    await tx.coatingReminder.deleteMany({ where: { vehicle: { clientId } } });
    // Quotes without orders can be removed with a history-free client.
    if (!orders.length) {
      await tx.quote.deleteMany({ where: { clientId } });
      await tx.vehicle.deleteMany({ where: { clientId } });
      await tx.client.deleteMany({ where: { id: clientId } });
      return { outcome: "deleted" as const };
    }
    await tx.quote.updateMany({ where: { clientId }, data: { notes: null } });
    await tx.vehicle.updateMany({ where: { clientId }, data: { plate: "USUNIĘTO", color: null } });
    await tx.client.updateMany({ where: { id: clientId }, data: {
      name: "Klient zanonimizowany", email: null, phone: null, street: null, postal: null, city: null, nip: null, isRegular: false,
    } });
    return { outcome: "anonymized" as const };
  }, { isolationLevel: "Serializable", timeout: 60_000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2003"].includes(error.code)) {
      throw new ClientError(409, "Dane klienta zmieniły się równolegle. Ponów żądanie.");
    }
    throw error;
  });
  await platformDb.auditLog.create({ data: { studioId, actorId, action: "client.privacy.erase.complete", meta: { clientId, outcome: result.outcome } } });
  return result;
}
