"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { activeAdminItem, adminNavigation, platformRoleLabel } from "./navigation";

function NavigationIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-[18px] shrink-0 bg-current"
      style={{ mask: `url(/admin/${name}.svg) center / contain no-repeat` }}
    />
  );
}

export function AdminSidebar({
  user,
  role,
}: {
  user: { name: string; email: string };
  role: keyof typeof platformRoleLabel;
}) {
  const active = activeAdminItem(usePathname());

  return (
    <aside
      aria-label="Panel platformy"
      className="fixed inset-y-0 left-0 z-20 flex h-dvh w-[220px] flex-col gap-2 overflow-hidden bg-df-side p-4"
    >
      <Link
        href="/admin"
        aria-label="Detailflow — przegląd platformy"
        className="flex h-[60px] shrink-0 items-center gap-2.5 px-3"
      >
        <LogoMark size={32} />
        <span className="font-brand text-df-wordmark">detailflow</span>
      </Link>

      <p className="flex h-8 shrink-0 items-center justify-center rounded-md bg-df-lime-dark px-2 text-[10px] font-semibold tracking-[0.08em] text-df-lime">
        {platformRoleLabel[role]}
      </p>

      <nav aria-label="Nawigacja platformy" className="mt-4 min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        <p className="mb-2 text-df-label tracking-[0.96px] text-df-muted/55">PLATFORM</p>
        <ul className="flex flex-col gap-2">
          {adminNavigation.map((item) => {
            const selected = active?.href === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex h-[42px] items-center gap-3 rounded-lg pl-3.5 pr-2 text-df-body",
                    selected ? "bg-df-lime-dark text-df-lime" : "text-df-muted hover:bg-df-raised hover:text-df-text",
                  )}
                >
                  <NavigationIcon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-df-line pt-3">
        <div className="flex min-h-[42px] items-start gap-2.5 px-1 text-df-label">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-df-raised">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate">{user.name}</p>
            <p className="truncate text-df-muted">{user.email}</p>
          </div>
        </div>
        <Link
          href="/admin/logout"
          className="mt-2 flex h-9 items-center gap-2.5 rounded-lg px-2 text-df-label text-df-muted hover:bg-df-raised hover:text-df-text"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M9 5H5v14h4M13 8l4 4-4 4M9 12h12" />
          </svg>
          Wyloguj
        </Link>
      </div>
    </aside>
  );
}
