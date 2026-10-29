import { z } from "zod";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError, authorizeStudio } from "../acl";

async function teamAccess(actorId: string, studioId: string, write = false) {
  const db = studioDb(studioId);
  if (!await db.membership.findFirst({ where: { userId: actorId }, select: { id: true } })) {
    throw new AccessError(404, "Nie znaleziono studia.");
  }
  await authorizeStudio(actorId, studioId, "members:invite", write);
  return db;
}

export async function listTeam(actorId: string, studioId: string) {
  const db = await teamAccess(actorId, studioId);
  const [members, invitations] = await Promise.all([
    db.membership.findMany({ orderBy: { createdAt: "asc" }, select: {
      id: true, role: true, user: { select: { id: true, name: true, email: true } },
    } }),
    db.invitation.findMany({ where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "asc" }, select: { id: true, email: true, role: true, expiresAt: true } }),
  ]);
  return { members, invitations };
}

const roleInput = z.enum(["manager", "worker"]);

export async function changeMember(actorId: string, studioId: string, membershipId: string, role?: unknown) {
  const db = await teamAccess(actorId, studioId, true);
  const nextRole = role === undefined ? undefined : roleInput.parse(role);
  const member = await db.membership.findFirst({ where: { id: membershipId } });
  if (!member) throw new AccessError(404, "Nie znaleziono członka zespołu.");
  // Własność studia nie jest przekazywana przez zarządzanie zespołem.
  // Chronimy wszystkich ownerów, również przy równoległych żądaniach.
  if (member.role === "owner") throw new AccessError(409, "Nie można zmienić ani usunąć właściciela tą ścieżką.");
  await platformDb.$transaction([
    nextRole === undefined
      ? db.membership.delete({ where: { id: membershipId, role: { not: "owner" } } })
      : db.membership.update({ where: { id: membershipId, role: { not: "owner" } }, data: { role: nextRole } }),
    platformDb.auditLog.create({ data: { actorId, studioId,
      action: nextRole === undefined ? "studio.member.remove" : "studio.member.role",
      meta: { membershipId, userId: member.userId, previousRole: member.role, ...(nextRole ? { role: nextRole } : {}) },
    } }),
  ]);
}
