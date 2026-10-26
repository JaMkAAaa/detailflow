"use client";

import Link from "next/link";
import { useState } from "react";
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

type Choice = {
  studioId: string;
  role: "owner" | "manager" | "worker";
  studio: { name: string; city: string | null; district: string | null };
};
export function Sidebar({
  choices,
  studioId,
  user,
}: {
  choices: Choice[];
  studioId: string;
  user: { name: string };
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
      className="fixed inset-y-0 left-0 z-20 flex h-dvh w-[220px] flex-col gap-2 overflow-hidden bg-df-side p-4"
    >
      <Link
        href="/"
        aria-label="Detailflow — pulpit"
        className="flex h-[60px] shrink-0 items-center gap-2.5 px-3"
      >
        <LogoMark size={32} />
        <span className="font-brand text-df-wordmark">detailflow</span>
      </Link>

      <div className="relative h-[60px] shrink-0 rounded-[10px] bg-df-raised text-df-label">
        <select
          aria-label="Wybierz studio"
          value={studioId}
          disabled={pending}
          onChange={(event) => void switchStudio(event.target.value)}
          className="h-full w-full cursor-pointer appearance-none rounded-[10px] bg-transparent px-3 pt-3 pb-[30px] text-df-text"
        >
          {choices.map((choice) => (
            <option key={choice.studioId} value={choice.studioId}>
              {choice.studio.name}
            </option>
          ))}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 bottom-3 left-3 flex justify-between text-df-muted"
        >
          <span>
            {[current.studio.city, current.studio.district]
              .filter(Boolean)
              .join(", ")}
          </span>
          <span>⌄</span>
        </span>
      </div>

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
            if (item.href === "/invoices" && current.role === "worker")
              return null;
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
                  {item.icon === "faktury" && (
                    <span
                      aria-label="2 faktury wymagają uwagi"
                      className="flex h-6 w-[30px] items-center justify-center rounded-xl bg-df-error-surface text-xs text-df-error"
                    >
                      2
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
          {comingSoon.map((item) => (
            <li key={item.icon}>
              <button
                type="button"
                disabled
                className="flex h-[42px] w-full cursor-not-allowed items-center gap-3 rounded-lg pl-3.5 text-left text-df-muted"
              >
                <NavigationIcon name={item.icon} />
                <span className="flex-1 text-df-body">{item.label}</span>
                <span className="rounded bg-df-raised px-1 py-0.5 text-[9px]">
                  Wkrótce
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="pt-4">
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
