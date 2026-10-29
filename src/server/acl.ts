import { platformDb } from "../../lib/db/client";
import { restrictedMessage } from "./billing/access";
import { studioDb } from "../../lib/db/tenant";
import type { MembershipRole } from "../../lib/db/generated/client";
import { AccessError } from "./access-error";
export { AccessError } from "./access-error";

export const permissions = {
  "billing:manage": ["owner"],
  "studio:settings": ["owner"],
  "studio:select": ["owner", "manager", "worker"],
  "studio:read": ["owner", "manager", "worker"],
  "orders:write": ["owner", "manager", "worker"],
  "orders:update": ["owner", "manager", "worker"],
  "clients:privacy": ["owner", "manager"],
  "quotes:write": ["owner", "manager"],
  "invoices:manage": ["owner", "manager"],
  "members:invite": ["owner", "manager"],
} as const satisfies Record<string, readonly MembershipRole[]>;
export type Permission = keyof typeof permissions;

export async function authorizeStudio(userId: string, studioId: string, permission: Permission = "studio:read", write = false) {
  const db = studioDb(studioId);
  const member = await db.membership.findFirst({ where: { userId } });
  if (!member || !(permissions[permission] as readonly string[]).includes(member.role)) {
    throw new AccessError(403, "Brak dostępu.");
  }
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId }, select: { status: true, trialEndsAt: true } });
  const restriction = restrictedMessage(studio);
  if (write && permission !== "billing:manage" && permission !== "studio:select" && restriction) throw new AccessError(403, `${restriction} Dostęp tylko do odczytu.`);
  return { db, member, restriction };
}
