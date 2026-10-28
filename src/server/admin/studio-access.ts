import { platformDb } from "@/lib/db/client";
import { PlatformError } from "./errors";

export const SUPPORT_SESSION_MS = 15 * 60 * 1000;
/** Sesja wsparcia nie tworzy `Session` i nie daje zapisu w studiu. */
export const SUPPORT_SESSION_ACCESS = "read" as const;

export function studioNameConfirmed(expected: string, given: string) {
  const left = expected.normalize("NFC").trim();
  const right = given.normalize("NFC").trim();
  return left.length > 0 && left === right;
}

export async function startSupportSession(input: {
  actorId: string;
  publicCode: string;
  reason: string;
  ticketCode: string;
  now?: Date;
}) {
  const reason = input.reason.trim();
  const ticketCode = input.ticketCode.trim();
  if (!reason) throw new PlatformError("Podaj powód sesji.");
  if (!ticketCode) throw new PlatformError("Podaj numer zgłoszenia.");
  const studio = await platformDb.studio.findUnique({
    where: { publicCode: input.publicCode },
    select: { id: true },
  });
  if (!studio) throw new PlatformError("Nie ma takiego studia.");
  const ticket = await platformDb.supportTicket.findUnique({
    where: { publicCode: ticketCode },
    select: { id: true, studioId: true, publicCode: true },
  });
  if (!ticket || ticket.studioId !== studio.id) throw new PlatformError("Zgłoszenie nie należy do tego studia.");
  const startedAt = input.now ?? new Date();
  const expiresAt = new Date(startedAt.getTime() + SUPPORT_SESSION_MS);
  await platformDb.$transaction(async (tx) => {
    await tx.supportSession.updateMany({
      where: { studioId: studio.id, actorId: input.actorId, endedAt: null },
      data: { endedAt: startedAt },
    });
    await tx.supportSession.create({
      data: {
        studioId: studio.id,
        actorId: input.actorId,
        ticketId: ticket.id,
        reason,
        startedAt,
        expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        studioId: studio.id,
        action: "support.session.started",
        meta: { ticketCode: ticket.publicCode, expiresAt: expiresAt.toISOString(), access: SUPPORT_SESSION_ACCESS },
      },
    });
  });
  return { expiresAt, access: SUPPORT_SESSION_ACCESS };
}

export async function activeSupportSession(actorId: string, publicCode: string, now = new Date()) {
  const studio = await platformDb.studio.findUnique({ where: { publicCode }, select: { id: true } });
  if (!studio) return null;
  const session = await platformDb.supportSession.findFirst({
    where: { studioId: studio.id, actorId, endedAt: null, expiresAt: { gt: now } },
    orderBy: { startedAt: "desc" },
    select: { expiresAt: true, reason: true, ticket: { select: { publicCode: true } } },
  });
  if (!session) return null;
  return {
    expiresAt: session.expiresAt,
    reason: session.reason,
    ticketCode: session.ticket?.publicCode ?? null,
    access: SUPPORT_SESSION_ACCESS,
  };
}

export async function suspendStudio(input: { actorId: string; publicCode: string; name: string; reason: string }) {
  const reason = input.reason.trim();
  if (!reason) throw new PlatformError("Podaj powód zawieszenia.");
  const studio = await platformDb.studio.findUnique({
    where: { publicCode: input.publicCode },
    select: { id: true, name: true, status: true },
  });
  if (!studio) throw new PlatformError("Nie ma takiego studia.");
  if (!studioNameConfirmed(studio.name, input.name)) {
    throw new PlatformError("Nazwa studia się nie zgadza. Konto pozostaje bez zmian.");
  }
  if (studio.status === "suspended") throw new PlatformError("Konto jest już wstrzymane.");
  await platformDb.$transaction(async (tx) => {
    await tx.studio.update({ where: { id: studio.id }, data: { status: "suspended" } });
    await tx.auditLog.create({
      data: { actorId: input.actorId, studioId: studio.id, action: "studio.suspended", meta: { reason } },
    });
    const members = await tx.membership.findMany({ where: { studioId: studio.id }, select: { userId: true } });
    const userIds = [...new Set(members.map((member) => member.userId))];
    if (userIds.length === 0) return;
    const stillOpen = await tx.membership.findMany({
      where: { userId: { in: userIds }, studio: { status: { not: "suspended" } } },
      select: { userId: true },
    });
    const keep = new Set(stillOpen.map((row) => row.userId));
    const revoke = userIds.filter((id) => !keep.has(id));
    if (revoke.length > 0) await tx.session.deleteMany({ where: { userId: { in: revoke } } });
  });
}
