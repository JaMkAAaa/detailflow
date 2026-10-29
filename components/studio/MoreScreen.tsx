"use client";

import Link from "next/link";
import { useState } from "react";
import { NoticeSheet, type Notice } from "./NoticeSheet";
import { MaskIcon } from "./MaskIcon";
import { StudioPicker } from "./StudioPicker";
import { GlobalSearchTrigger } from "./GlobalSearch";

type MenuItem = { label: string; icon: string; href?: string; count?: number };

function MenuIcon({ icon }: { icon: string }) {
  if (icon === "help" || icon === "logout")
    return <span aria-hidden="true">{icon === "help" ? "?" : "↗"}</span>;
  const path =
    icon === "settings" ? "/mobile-sales/settings.svg" : `/studio/${icon}.svg`;
  return (
    <span
      aria-hidden="true"
      className="size-[18px] bg-current"
      style={{ mask: `url(${path}) center / contain no-repeat` }}
    />
  );
}

export function MoreScreen({
  studio,
  name,
  location,
  role,
  attentionCount,
  choices,
  studioId,
}: {
  choices: { studioId: string; studio: { name: string } }[];
  studioId: string;
  studio: string;
  name: string;
  location: string;
  role: "owner" | "manager" | "worker";
  attentionCount: number;
}) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const soon = (title: string) =>
    setNotice({
      title: `${title} · Wkrótce`,
      description: "Ten moduł będzie dostępny w kolejnej wersji Detailflow.",
    });
  const rowClass =
    "flex min-h-[63px] w-full items-center gap-3.5 border-b border-df-line py-3 text-left last:border-0";
  const groups: { title: string; items: MenuItem[] }[] = [
    {
      title: "SPRZEDAŻ",
      items: [
        ...(role === "worker"
          ? []
          : [
              {
                label: "Faktury",
                icon: "faktury",
                href: "/invoices",
                count: attentionCount,
              },
            ]),
        { label: "Klienci i auta", icon: "klienci", href: "/customers" },
        { label: "Usługi i cennik", icon: "uslugi" },
      ],
    },
    {
      title: "STUDIO",
      items: [
        { label: "Magazyn", icon: "magazyn" },
        { label: "Statystyki", icon: "statystyki" },
        { label: "Portfolio", icon: "portfolio" },
      ],
    },
    {
      title: "KONTO",
      items: [
        ...(role === "owner"
          ? [
              { label: "Abonament Detailflow", icon: "settings", href: "/billing" },
              { label: "Ustawienia i KSeF", icon: "settings", href: "/settings" },
            ]
          : []),
        ...(role === "worker" ? [] : [{ label: "Zaproś do studia", icon: "klienci", href: "/team" }]),
        { label: "Pomoc", icon: "help" },
        { label: "Wyloguj", icon: "logout", href: "/logout" },
      ],
    },
  ];
  return (
    <div className="mx-auto max-w-xl space-y-4 leading-[normal]">
      <header>
        <p className="text-[13px] text-df-muted">{studio}</p>
        <h1 className="text-[26px] font-bold">Więcej</h1>
        <div className="mt-4"><GlobalSearchTrigger compact /></div>
      </header>
      <StudioPicker choices={choices} studioId={studioId} />
      <button
        type="button"
        onClick={() => soon("Konto")}
        className="flex w-full items-center gap-3 rounded-[18px] bg-df-panel p-4 text-left"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-df-raised text-[15px] font-semibold">
          {name
            .split(" ")
            .map((part) => part[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold">{name}</span>
          <span className="text-[12px] text-df-muted">
            {role === "owner"
              ? "Właściciel"
              : role === "manager"
                ? "Manager"
                : "Pracownik"}
            {location && ` · ${location}`}
          </span>
        </span>
        <MaskIcon name="chevron-right" size={18} className="text-df-muted" />
      </button>
      {groups.map((group) => (
        <section key={group.title} className="space-y-4">
          <h2 className="text-[11px] font-semibold text-df-muted">
            {group.title}
          </h2>
          <div className="rounded-[18px] bg-df-panel px-4 py-1">
            {group.items.map((item) => {
              const content = (
                <>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-df-raised text-df-lime">
                    <MenuIcon icon={item.icon} />
                  </span>
                  <span className="flex-1 text-[15px]">{item.label}</span>{" "}
                  {!!item.count && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-df-amber-dark px-2 py-1 text-[12px] font-semibold text-df-amber">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/mobile-sales/attention.svg"
                        width={6}
                        height={6}
                        alt=""
                      />
                      {item.count} wymagają uwagi
                    </span>
                  )}{" "}
                  {!item.href && (
                    <span className="text-[11px] text-df-muted">Wkrótce</span>
                  )}
                  <MaskIcon
                    name="chevron-right"
                    size={18}
                    className="text-df-muted"
                  />
                </>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} className={rowClass}>
                  {content}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => soon(item.label)}
                  className={rowClass}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <NoticeSheet notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
