"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MaskIcon } from "./MaskIcon";


const tabs = {
  left: [
    { label: "Pulpit", href: "/", icon: "pulpit" },
    { label: "Kalendarz", href: "/calendar", icon: "kalendarz" },
  ],
  right: [{ label: "Zlecenia", href: "/orders", icon: "zlecenia" }],
} as const;

/** Trasy bez własnej zakładki — podświetlają „Więcej”. */
const moreRoutes = ["/more", "/invoices", "/customers", "/services", "/statistics", "/team", "/settings"];

/** Szczegóły zlecenia, FV i kreator wyceny mają własne akcje mobilne. */
const isOrderDetails = (pathname: string) => /^\/orders\/[^/]+/.test(pathname);

const isUnder = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

const tabClass = "flex h-12 w-[62px] shrink-0 flex-col items-center gap-1 text-[11px]";

function TabIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-[22px] shrink-0 bg-current"
      style={{ mask: `url(/studio/${name}.svg) center / contain no-repeat` }}
    />
  );
}

function RouteTab({ label, href, icon, active }: { label: string; href: string; icon: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(tabClass, active ? "font-semibold text-df-lime" : "font-medium text-df-muted")}
    >
      <TabIcon name={icon} />
      {label}
    </Link>
  );
}

export function TabBar() {
  const pathname = usePathname();
  const moreActive = moreRoutes.some((href) => isUnder(pathname, href));

  return (
    <>
      <nav
        aria-label="Nawigacja mobilna"
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-df-line bg-df-side px-3 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))] lg:hidden",
          (isOrderDetails(pathname) || /^\/invoices\/(?!new$|attention$)[^/]+/.test(pathname) || pathname === "/quotes/new") && "max-lg:hidden",
        )}
      >
        {tabs.left.map((tab) => (
          <RouteTab key={tab.href} {...tab} active={isUnder(pathname, tab.href)} />
        ))}
        <Link
          href="/orders?new=1"
          aria-label="Nowe zlecenie"
          className="flex h-12 w-14 shrink-0 items-center justify-center rounded-[18px] bg-df-lime text-df-bg"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
        {tabs.right.map((tab) => (
          <RouteTab key={tab.href} {...tab} active={isUnder(pathname, tab.href)} />
        ))}
        <Link href="/more" aria-current={moreActive ? "page" : undefined} className={cn(tabClass, moreActive ? "font-semibold text-df-lime" : "font-medium text-df-muted")}>
          <MaskIcon name="more" size={22} />Więcej
        </Link>
      </nav>

    </>
  );
}
