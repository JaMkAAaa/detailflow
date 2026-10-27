"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sheet } from "./Sheet";

type Role = "owner" | "manager" | "worker";
type Panel = "new" | "more" | null;

const tabs = {
  left: [
    { label: "Pulpit", href: "/", icon: "pulpit" },
    { label: "Kalendarz", href: "/calendar", icon: "kalendarz" },
  ],
  right: [{ label: "Zlecenia", href: "/orders", icon: "zlecenia" }],
} as const;

/** Trasy bez własnej zakładki — podświetlają „Więcej”. */
const moreRoutes = ["/invoices", "/customers", "/team"];

/** Szczegóły zlecenia (M-04) mają własny dolny pasek akcji zamiast tab bara. */
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

export function TabBar({ role }: { role: Role }) {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const moreActive = moreRoutes.some((href) => isUnder(pathname, href));
  const close = () => {
    setPanel(null);
    setNotice(null);
  };

  return (
    <>
      <nav
        aria-label="Nawigacja mobilna"
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 flex items-center justify-between border-t border-df-line bg-df-side px-3 pt-2.5 pb-[max(1.75rem,env(safe-area-inset-bottom))] lg:hidden",
          isOrderDetails(pathname) && "max-lg:hidden",
        )}
      >
        {tabs.left.map((tab) => (
          <RouteTab key={tab.href} {...tab} active={isUnder(pathname, tab.href)} />
        ))}
        <button
          type="button"
          aria-label="Nowe zlecenie lub wycena"
          aria-haspopup="dialog"
          onClick={() => setPanel("new")}
          className="flex h-12 w-14 shrink-0 items-center justify-center rounded-[18px] bg-df-lime text-df-bg"
        >
          <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        {tabs.right.map((tab) => (
          <RouteTab key={tab.href} {...tab} active={isUnder(pathname, tab.href)} />
        ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setPanel("more")}
          className={cn(tabClass, moreActive ? "font-semibold text-df-lime" : "font-medium text-df-muted")}
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="currentColor" className="shrink-0">
            <circle cx="5" cy="11" r="1.75" />
            <circle cx="11" cy="11" r="1.75" />
            <circle cx="17" cy="11" r="1.75" />
          </svg>
          Więcej
        </button>
      </nav>

      <Sheet open={panel === "new"} onClose={close} title="Nowe">
        <ul className="flex flex-col gap-2">
          {[
            { label: "Nowe zlecenie", hint: "Przyjmij auto i otwórz zlecenie", soon: "Przyjmowanie nowych zleceń będzie dostępne wkrótce." },
            { label: "Nowa wycena", hint: "Przygotuj wycenę dla klienta i auta", href: "/quotes/new", soon: "" },
          ].map((item) => (
            <li key={item.label}>
              {item.href ? <Link href={item.href} onClick={close} className="flex min-h-14 w-full flex-col items-start justify-center rounded-[14px] bg-df-raised px-4 py-2 text-left">
                <span className="text-df-strong">{item.label}</span>
                <span className="text-df-label text-df-muted">{item.hint}</span>
              </Link> : <button
                type="button"
                onClick={() => setNotice(item.soon)}
                className="flex min-h-14 w-full flex-col items-start justify-center rounded-[14px] bg-df-raised px-4 py-2 text-left"
              >
                <span className="text-df-strong">{item.label}</span>
                <span className="text-df-label text-df-muted">{item.hint}</span>
              </button>}
            </li>
          ))}
        </ul>
        {notice && (
          <p role="status" className="text-df-body text-df-muted">
            {notice}
          </p>
        )}
      </Sheet>

      <Sheet open={panel === "more"} onClose={close} title="Więcej">
        <ul className="flex flex-col gap-2">
          {[
            ...(role === "worker" ? [] : [{ label: "Faktury", href: "/invoices" }]),
            { label: "Klienci i auta", href: "/customers" },
            ...(role === "worker" ? [] : [{ label: "Zaproś do studia", href: "/team" }]),
            { label: "Wyloguj", href: "/logout" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={close}
                className="flex h-12 items-center rounded-[14px] bg-df-raised px-4 text-df-strong"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
