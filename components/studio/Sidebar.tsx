"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";
import { KsefEnvBadge } from "@/components/ksef/KsefEnvBadge";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { activeStudioItem, studioNavigation } from "./navigation";

function NavigationIcon({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-[18px] shrink-0 bg-current"
      style={{ mask: `url(/studio/${name}.svg) center / contain no-repeat` }}
    />
  );
}

type Choice = {
  studioId: string;
  role: "owner" | "manager" | "worker";
  studio: { name: string; city: string | null; district: string | null; ksefEnv: "test" | "production" };
};
export function Sidebar({
  choices,
  studioId,
  user,
  attentionCount = 0,
}: {
  choices: Choice[];
  studioId: string;
  user: { name: string };
  attentionCount?: number;
}) {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const current = choices.find((choice) => choice.studioId === studioId)!;
  async function switchStudio(value: string) {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/studios/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studioId: value }),
      });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch {
      setError(true);
      setPending(false);
    }
  }
  const active = activeStudioItem(usePathname());

  return (
    <aside
      aria-label="Panel studia"
      className="fixed inset-y-0 left-0 z-20 hidden h-dvh w-[220px] flex-col gap-2 overflow-hidden bg-df-side p-4 lg:flex"
    >
      <Link
        href="/"
        aria-label="Detailflow — pulpit"
        className="flex h-[60px] shrink-0 items-center gap-2.5 px-3"
      >
        <LogoMark size={32} />
        <span className="font-brand text-df-wordmark">detailflow</span>
      </Link>

      <Select
        aria-label="Wybierz studio"
        size="studio"
        className="shrink-0"
        value={studioId}
        disabled={pending}
        onChange={(event) => void switchStudio(event.target.value)}
        options={choices.map((choice) => ({
          value: choice.studioId,
          label: choice.studio.name,
          description: [choice.studio.city, choice.studio.district].filter(Boolean).join(", ") || undefined,
        }))}
      />

      <div className="px-1"><KsefEnvBadge env={current.studio.ksefEnv} /></div>
      {error && <p role="alert">Nie udało się zmienić studia.</p>}
      <nav
        aria-label="Nawigacja studia"
        className="mt-4 min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]"
      >
        <p className="mb-2 text-df-label tracking-[0.96px] text-df-muted/55">
          TWOJE STUDIO
        </p>
        <ul className="flex flex-col gap-2">
          {studioNavigation.map((item) => {
            if ((item.href === "/invoices" || item.href === "/services") && current.role === "worker")
              return null;
            // Statystyki studia widzi tylko właściciel (permission stats:read).
            if (item.href === "/statistics" && current.role !== "owner") return null;
            const selected = active?.href === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex h-[42px] items-center gap-3 rounded-lg pl-3.5 pr-2 text-df-body",
                    selected
                      ? "bg-df-lime-dark text-df-lime"
                      : "text-df-muted hover:bg-df-raised hover:text-df-text",
                  )}
                >
                  <NavigationIcon name={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {item.icon === "faktury" && attentionCount > 0 && (
                    <span
                      aria-label={`Wymagają uwagi: ${attentionCount}`}
                      className="flex h-6 w-[30px] items-center justify-center rounded-xl bg-df-error-surface text-xs text-df-error"
                    >
                      {attentionCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="pt-4">
          <Link href="/account" className="block p-3 text-df-label">Konto</Link>
          {current.role === "owner" && <Link href="/billing" className="block p-3 text-df-label">Abonament Detailflow</Link>}
          {current.role === "owner" && <Link href="/settings" className="block p-3 text-df-label">Ustawienia i KSeF</Link>}
          {current.role !== "worker" && (
            <Link href="/team" className="block p-3 text-df-label">
              Zaproś do studia
            </Link>
          )}
          <div className="flex h-[70px] flex-col gap-1 p-3 text-df-label">
            <p>Potrzebujesz pomocy?</p>
            <span className="text-df-muted">Centrum wsparcia ↗</span>
          </div>
        </div>
      </nav>

      <div className="shrink-0 border-t border-df-line pt-3">
        <div className="flex min-h-[42px] items-start gap-2.5 px-1 text-df-label">
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-df-raised">
            {user.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="flex flex-col gap-0.5">
            <p>{user.name}</p>
            <p className="text-df-muted">
              {
                {
                  owner: "Właściciel",
                  manager: "Manager",
                  worker: "Pracownik",
                }[current.role]
              }
            </p>
          </div>
        </div>
        <Link
          href="/logout"
          className="mt-2 flex h-9 items-center gap-2.5 rounded-lg px-2 text-df-label text-df-muted hover:bg-df-raised hover:text-df-text"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M9 5H5v14h4M13 8l4 4-4 4M9 12h12" />
          </svg>
          Wyloguj
        </Link>
      </div>
    </aside>
  );
}
