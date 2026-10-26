"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { activeStudioItem, studioNavigation } from "./navigation";

const comingSoon = [
  { label: "Usługi i cennik", icon: "uslugi" },
  { label: "Magazyn", icon: "magazyn" },
  { label: "Statystyki", icon: "statystyki" },
  { label: "Portfolio", icon: "portfolio" },
];

function NavigationIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-[18px] shrink-0 bg-current"
      style={{ mask: `url(/studio/${name}.svg) center / contain no-repeat` }}
    />
  );
}

export function Sidebar() {
  const active = activeStudioItem(usePathname());

  return (
    <aside aria-label="Panel studia" className="flex w-[220px] shrink-0 flex-col gap-2 bg-df-side p-4">
      <Link href="/" aria-label="Detailflow — pulpit" className="flex h-[60px] shrink-0 items-center gap-2.5 px-3">
        <LogoMark size={32} />
        <span className="font-brand text-df-wordmark">detailflow</span>
      </Link>

      {/* Dane demonstracyjne; wybór tenantów zostanie podłączony wraz z sesją. */}
      <div className="relative h-[60px] shrink-0 rounded-[10px] bg-df-raised text-df-label">
        <select aria-label="Wybierz studio" defaultValue="obsidian" className="h-full w-full cursor-pointer appearance-none rounded-[10px] bg-transparent px-3 pt-3 pb-[30px] text-df-text">
          <option value="obsidian">OBSIDIAN STUDIO</option>
        </select>
        <span aria-hidden="true" className="pointer-events-none absolute right-3 bottom-3 left-3 flex justify-between text-df-muted">
          <span>Warszawa, Mokotów</span><span>⌄</span>
        </span>
      </div>

      <nav aria-label="Nawigacja studia" className="mt-4">
        <p className="mb-2 text-df-label tracking-[0.96px] text-df-muted/55">TWOJE STUDIO</p>
        <ul className="flex flex-col gap-2">
          {studioNavigation.map((item) => {
            const selected = active?.href === item.href;
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={selected ? "page" : undefined} className={cn(
                  "flex h-[42px] items-center gap-3 rounded-lg pl-3.5 pr-2 text-df-body",
                  selected ? "bg-df-lime-dark text-df-lime" : "text-df-muted hover:bg-df-raised hover:text-df-text",
                )}>
                  <NavigationIcon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {item.icon === "faktury" && <span aria-label="2 faktury wymagają uwagi" className="flex h-6 w-[30px] items-center justify-center rounded-xl bg-df-error-surface text-xs text-df-error">2</span>}
                </Link>
              </li>
            );
          })}
          {comingSoon.map((item) => (
            <li key={item.icon}>
              <button type="button" disabled className="flex h-[42px] w-full cursor-not-allowed items-center gap-3 rounded-lg pl-3.5 text-left text-df-muted">
                <NavigationIcon name={item.icon} />
                <span className="flex-1 text-df-body">{item.label}</span>
                <span className="rounded bg-df-raised px-1 py-0.5 text-[9px]">Wkrótce</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-auto pt-8">
        <div className="flex h-[70px] flex-col gap-1 p-3 text-df-label">
          <p>Potrzebujesz pomocy?</p>
          <span className="text-df-muted">Centrum wsparcia ↗</span>
        </div>
        <div className="mt-2 flex min-h-[50px] items-start gap-2.5 border-t border-df-line px-1 pt-3 text-df-label">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-df-raised">MK</span>
          <div className="flex flex-col gap-0.5"><p>Michał Kowalski</p><p className="text-df-muted">Właściciel</p></div>
        </div>
      </div>
    </aside>
  );
}
