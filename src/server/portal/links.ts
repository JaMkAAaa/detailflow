import { platformDb } from "../../../lib/db/client";
import { studioDb, type StudioDb } from "../../../lib/db/tenant";
import { generatePortalToken, hashPortalToken } from "../../../lib/portal/token";
import { OrderError } from "../zlecenia/errors";
import { acceptProtocol } from "../zlecenia/intake";
import { portalPhotoPath } from "./media";
import { PORTAL_TTL_MS } from "./ttl";

export { PORTAL_TTL_MS };
export class PortalLinkError extends Error {
  constructor() { super("Link wygasł lub jest nieprawidłowy."); }
}

type Target = { quoteId: string; workOrderId?: never } | { workOrderId: string; quoteId?: never };

// Wywołujący API studia musi najpierw wykonać authorizeStudio.
export async function createPortalLink(db: StudioDb, studioId: string, target: Target) {
  const found = target.quoteId
    ? await db.quote.findFirst({ where: { id: target.quoteId } })
    : await db.workOrder.findFirst({ where: { id: target.workOrderId } });
  if (!found) throw new PortalLinkError();
  const token = generatePortalToken();
  const link = await db.portalLink.create({ data: {
    studioId, ...target, tokenHash: hashPortalToken(token), expiresAt: new Date(Date.now() + PORTAL_TTL_MS),
  } });
  // Surowy token zwracamy tylko jako URL. Nie przekazywać do loggera ani outboxa.
  return { id: link.id, expiresAt: link.expiresAt, path: `/p/${token}` };
}

export async function revokePortalLink(db: StudioDb, id: string) {
  return db.portalLink.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function resolvePortalLink(token: string) {
  // Limit długości; akceptujemy też jawne tokeny demonstracyjne istniejącego seeda.
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(token)) return null;
  // Jedyny odczyt bez tenanta: granica auth odkrywająca studio po hashu sekretu.
  const link = await platformDb.portalLink.findUnique({
    where: { tokenHash: hashPortalToken(token) }, select: { id: true, studioId: true },
  });
  if (!link) return null;
  const db = studioDb(link.studioId);
  return db.portalLink.findFirst({ where: { id: link.id, revokedAt: null, expiresAt: { gt: new Date() } } });
}

export async function readPortal(token: string) {
  const link = await resolvePortalLink(token);
  if (!link) return null;
  const db = studioDb(link.studioId);
  const order = link.workOrderId ? await db.workOrder.findFirst({ where: { id: link.workOrderId }, include: {
    vehicle: { select: { make: true, model: true, plate: true } },
    client: { select: { name: true } },
  } }) : null;
  if (link.workOrderId && !order) return null;
  const quoteId = link.quoteId ?? order?.quoteId;
  const quote = quoteId ? await db.quote.findFirst({ where: { id: quoteId }, include: {
    items: { orderBy: { sort: "asc" } }, vehicle: { select: { make: true, model: true, plate: true } },
  } }) : null;
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: link.studioId }, select: { name: true, phone: true, address: true } });
  const photos = order ? await listPortalPhotos(db, link.id, order.id) : [];
  const protocol = order ? await readPortalProtocol(db, order.id) : null;
  return { studio, order, quote, photos, protocol };
}

async function listPortalPhotos(db: StudioDb, linkId: string, workOrderId: string) {
  const rows = await db.orderPhoto.findMany({
    where: { workOrderId, uploadedAt: { not: null } },
    orderBy: { no: "asc" },
    select: { id: true, no: true, caption: true },
  });
  return rows.map((photo) => ({ no: photo.no, caption: photo.caption, url: portalPhotoPath(linkId, photo.id) }));
}

async function readPortalProtocol(db: StudioDb, workOrderId: string) {
  const protocol = await db.intakeProtocol.findFirst({
    where: { workOrderId },
    select: {
      number: true, acceptedAt: true,
      damages: { orderBy: { no: "asc" }, select: { no: true, title: true, part: true, size: true, posX: true, posY: true } },
    },
  });
  if (!protocol) return null;
  return {
    number: protocol.number,
    acceptedAt: protocol.acceptedAt,
    damages: protocol.damages.map(({ posX, posY, ...damage }) => ({ ...damage, x: posX, y: posY })),
  };
}

/** Ta sama flaga co akceptacja w studiu. Brak protokołu nic nie zapisuje. Zły token → PortalLinkError (P-02). */
export async function acceptPortalProtocol(token: string) {
  const link = await resolvePortalLink(token);
  if (!link) throw new PortalLinkError();
  if (!link.workOrderId) return;
  const db = studioDb(link.studioId);
  const protocol = await db.intakeProtocol.findFirst({ where: { workOrderId: link.workOrderId }, select: { id: true } });
  if (!protocol) return;
  try {
    await acceptProtocol(link.studioId, link.workOrderId);
  } catch (error) {
    if (error instanceof OrderError && error.status === 404) return;
    throw error;
  }
}

export async function decideQuote(token: string, decision: "accepted" | "rejected") {
  if (decision !== "accepted" && decision !== "rejected") throw new PortalLinkError();
  const link = await resolvePortalLink(token);
  if (!link) throw new PortalLinkError();
  const db = studioDb(link.studioId);
  await db.$transaction(async (tx) => {
    // Zapis blokuje wiersz linku: revoke i decyzja mają jednoznaczną kolejność.
    const active = await tx.portalLink.updateMany({ where: {
      id: link.id, revokedAt: null, expiresAt: { gt: new Date() },
    }, data: { revokedAt: null } });
    if (!active.count) throw new PortalLinkError();
    const order = link.workOrderId ? await tx.workOrder.findFirst({ where: { id: link.workOrderId } }) : null;
    const quoteId = link.quoteId ?? order?.quoteId;
    if (!quoteId) throw new PortalLinkError();
    const changed = await tx.quote.updateMany({ where: { id: quoteId, status: "sent", decidedAt: null,
      OR: [{ sentAt: null }, { sentAt: { gt: new Date(Date.now() - PORTAL_TTL_MS) } }],
    },
      data: { status: decision, decidedAt: new Date() } });
    if (!changed.count) throw new PortalLinkError();
    await tx.quoteDecisionMail.create({ data: { studioId: link.studioId, quoteId } });
  });
}
