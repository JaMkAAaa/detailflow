"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeStudioItem } from "./navigation";

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
          <li aria-current="page">{pathname === "/quotes/new" ? "Nowa wycena" : pathname === "/invoices/attention" ? "Faktury / Wymagają uwagi" : pathname === "/invoices/new" ? "Faktury / Wystaw fakturę" : invoiceNumber ? `Faktury / ${invoiceNumber}` : active?.label ?? "Studio"}</li>
        </ol>
      </nav>
      <button type="button" disabled title="Wyszukiwanie — wkrótce" aria-label="Szukaj klienta, auta, zlecenia — wkrótce" className="flex w-[354px] shrink-0 cursor-not-allowed items-center gap-3 text-left">
        <span aria-hidden="true">⌕</span>
        <span className="flex-1">Szukaj klienta, auta, zlecenia…</span>
        <kbd className="font-sans">⌘K</kbd>
      </button>
      <span className="whitespace-nowrap text-[11px] font-semibold">● Online</span>
      <span aria-label="Michał Kowalski" className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-df-raised text-df-label text-df-text">MK</span>
    </header>
  );
}
