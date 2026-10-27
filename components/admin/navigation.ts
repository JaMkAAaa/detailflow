export const adminNavigation = [
  { label: "Przegląd", href: "/admin", icon: "przeglad" },
  { label: "Studia", href: "/admin/studios", icon: "studia" },
  { label: "Abonamenty", href: "/admin/subscriptions", icon: "abonamenty" },
  { label: "Analityka", href: "/admin/analytics", icon: "analityka" },
  { label: "System", href: "/admin/system", icon: "system" },
  { label: "Wsparcie", href: "/admin/support", icon: "wsparcie" },
  { label: "Administracja", href: "/admin/operators", icon: "administracja" },
] as const;

export function activeAdminItem(pathname: string) {
  return adminNavigation.find(({ href }) =>
    href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`),
  );
}

export const platformRoleLabel = {
  owner: "PLATFORM OWNER",
  support: "SUPPORT",
  admin: "ADMIN",
} as const;
