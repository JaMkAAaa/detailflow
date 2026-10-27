"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { navLinks } from "./content";
import { START_HREF } from "./primitives";

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-df-line/60 bg-df-bg/90 backdrop-blur">
        <div className="mx-auto flex h-[73px] max-w-[1200px] items-center justify-between gap-6 px-5 md:h-[84px] md:px-8 xl:px-0">
          <Link href="/" aria-label="detailflow — strona główna">
            <Logo size={28} />
          </Link>
          <nav aria-label="Główna" className="hidden items-center gap-7 lg:flex">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-[15px] text-df-muted hover:text-df-text">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-6 lg:flex">
            <Link href="/login" className="text-[15px] font-medium text-df-text hover:text-df-lime">
              Zaloguj się
            </Link>
            <Link href={START_HREF} className="rounded-xl bg-df-lime px-[26px] py-[11px] text-[15px] font-semibold text-df-bg hover:bg-df-green">
              Zacznij 14 dni za darmo
            </Link>
          </div>
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl border border-df-line text-df-text lg:hidden"
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label="Otwórz menu"
            onClick={() => setOpen(true)}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>
        </div>
      </header>

      {/* L-03: menu mobilne na pełnym ekranie. Poza <header>: backdrop-blur robi z niego blok dla `fixed`. */}
      <div
        id="landing-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!open}
        className="fixed inset-0 z-50 flex flex-col bg-df-bg lg:hidden"
      >
        <div className="flex h-[68px] items-center justify-between border-b border-df-line px-5">
          <Logo size={28} />
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-xl border border-df-line text-df-text"
            aria-label="Zamknij menu"
            onClick={() => setOpen(false)}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4l12 12M16 4 4 16" />
            </svg>
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto px-5 pt-2">
          {navLinks.map((link) => (
            <li key={link.href} className="border-b border-df-line/70 last:border-b-0">
              <a href={link.href} onClick={() => setOpen(false)} className="flex items-center justify-between gap-4 py-4">
                <span className="flex flex-col gap-0.5">
                  <span className="text-[24px] font-bold tracking-[-0.02em] text-df-text">{link.label}</span>
                  <span className="text-df-body text-df-muted">{link.hint}</span>
                </span>
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-df-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 3 5 5-5 5" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 px-5 pb-6 pt-4">
          <Link href={START_HREF} className="flex h-[50px] items-center justify-center rounded-xl bg-df-lime text-[16px] font-semibold text-df-bg">
            Zacznij 14 dni za darmo →
          </Link>
          <Link href="/login" className="flex h-[50px] items-center justify-center rounded-xl border border-df-line text-[16px] font-semibold text-df-text">
            Zaloguj się
          </Link>
          <p className="text-center text-df-body text-df-muted">Bez karty kredytowej · Polski support</p>
        </div>
      </div>
    </>
  );
}
