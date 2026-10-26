export const studioNavigation = [
  { label: "Pulpit", href: "/", icon: "pulpit" },
  { label: "Kalendarz", href: "/kalendarz", icon: "kalendarz" },
  { label: "Zlecenia", href: "/zlecenia", icon: "zlecenia" },
  { label: "Faktury", href: "/faktury", icon: "faktury" },
  { label: "Klienci i auta", href: "/klienci", icon: "klienci" },
] as const;

export function activeStudioItem(pathname: string) {
  return studioNavigation.find(({ href }) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
}
