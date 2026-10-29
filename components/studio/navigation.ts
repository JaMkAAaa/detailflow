export const studioNavigation = [
  { label: "Pulpit", href: "/", icon: "pulpit" },
  { label: "Kalendarz", href: "/calendar", icon: "kalendarz" },
  { label: "Zlecenia", href: "/orders", icon: "zlecenia" },
  { label: "Faktury", href: "/invoices", icon: "faktury" },
  { label: "Klienci i auta", href: "/customers", icon: "klienci" },
  { label: "Usługi i cennik", href: "/services", icon: "uslugi" },
  { label: "Magazyn", href: "/inventory", icon: "magazyn" },
  { label: "Statystyki", href: "/statistics", icon: "statystyki" },
  { label: "Portfolio", href: "/portfolio", icon: "portfolio" },
] as const;

export function activeStudioItem(pathname: string) {
  return studioNavigation.find(({ href }) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
  );
}
