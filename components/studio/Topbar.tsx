"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeStudioItem } from "./navigation";
import { GlobalSearchTrigger } from "./GlobalSearch";

export function Topbar() {
  const pathname = usePathname();
  const active = activeStudioItem(pathname);
  const invoiceNumber = pathname.startsWith("/invoices/") && pathname !== "/invoices/new" ? decodeURIComponent(pathname.slice("/invoices/".length)) : null;

  return (
    <header className="hidden h-[73px] shrink-0 items-center gap-4 border-b border-df-line px-7 text-df-body text-df-muted lg:flex">
      <nav aria-label="Okruszki" className="min-w-0 flex-1">
        <ol className="flex items-center gap-2">
          <li><Link href="/" className="hover:text-df-text">Studio</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">{pathname === "/more" ? "Więcej" : pathname === "/orders/new" ? "Zlecenia / Nowe zlecenie" : pathname === "/quotes/new" ? "Nowa wycena" : pathname === "/invoices/attention" ? "Faktury / Wymagają uwagi" : pathname === "/invoices/new" ? "Faktury / Wystaw fakturę" : invoiceNumber ? `Faktury / ${invoiceNumber}` : active?.label ?? "Studio"}</li>
        </ol>
      </nav>
      <GlobalSearchTrigger />
      <span className="whitespace-nowrap text-[11px] font-semibold">● Online</span>
      <span aria-label="Michał Kowalski" className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-df-raised text-df-label text-df-text">MK</span>
    </header>
  );
}
