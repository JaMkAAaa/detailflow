import { studioDb } from "../../lib/db/tenant";
import type { MembershipRole } from "../../lib/db/generated/client";

export const permissions = {
  "studio:read": ["owner", "manager", "worker"],
  "orders:write": ["owner", "manager", "worker"],
  "orders:update": ["owner", "manager", "worker"],
  "quotes:write": ["owner", "manager"],
  "invoices:manage": ["owner", "manager"],
  "members:invite": ["owner", "manager"],
} as const satisfies Record<string, readonly MembershipRole[]>;
export type Permission = keyof typeof permissions;

export class AccessError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409, message: string) { super(message); }
}

export async function authorizeStudio(userId: string, studioId: string, permission: Permission = "studio:read") {
  const db = studioDb(studioId);
  const member = await db.membership.findFirst({ where: { userId } });
  if (!member || !(permissions[permission] as readonly string[]).includes(member.role)) {
    throw new AccessError(403, "Brak dostępu.");
  }
  return { db, member };
}
