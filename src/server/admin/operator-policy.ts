import type { PlatformRole } from "@/lib/db/generated/client";

export const PLATFORM_ROLES = ["owner", "support", "admin"] as const;

export const ROLE_LABEL: Record<PlatformRole, string> = {
  owner: "Właściciel platformy",
  support: "Wsparcie",
  admin: "Administracja",
};

export function canManageRoles(role: PlatformRole) {
  return role === "owner";
}

export function canManageFlags(role: PlatformRole) {
  return role === "owner" || role === "admin";
}

export function demotionBlocked(role: PlatformRole, next: PlatformRole, owners: number) {
  return role === "owner" && next !== "owner" && owners <= 1;
}
