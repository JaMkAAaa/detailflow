"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/studio/Sheet";
import type { DashboardMetrics } from "@/src/server/pulpit/metrics";
import { useDashboardActions, type DashboardProps } from "./use-dashboard-actions";

type Order = DashboardMetrics["todayOrders"][number];

/** Nazwy etapów jak w Figmie (M-01, D-04); model trzyma tylko numer 1–4. */
const STAGES = ["Przyjęcie i mycie", "Korekta lakieru", "Aplikacja ceramiki", "Kontrola i odbiór"] as const;

const hour = (iso: string) =>
  new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** „do 12:00” dla pracy w toku, termin odbioru dla gotowych, start dla zaplanowanych. */
function timeLabel(order: Order) {
  if (order.status === "in-progress") return `do ${hour(order.scheduledTo)}`;
  if (order.status === "ready-for-pickup") return hour(order.dueAt ?? order.scheduledTo);
  return hour(order.scheduledFrom);
}

function rowDetail(order: Order) {
  return [order.service, order.bay ?? (order.status === "ready-for-pickup" ? "gotowe" : null)].filter(Boolean).join(" · ");
}

function Icon({ children, size }: { children: ReactNode; size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      {children}
    </svg>
  );
}

export function MobileDashboard({ data, name, studioId }: DashboardProps) {
  const { notice, setNotice, busy, act } = useDashboardActions(studioId);
  const [notifications, setNotifications] = useState(false);
  const featured = data.featured;
  const date = data.dateLabel.replace(/\s\d{4}$/, "");
  const orders = data.todayOrders.filter((order) => order.number !== featured?.number);
  const alerts = data.alerts;
  const stageName = featured ? STAGES[featured.stage - 1] : undefined;
  const nextStage = featured ? STAGES[featured.stage] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-df-body font-medium text-df-muted first-letter:uppercase">{date}</p>
          <h1 className="text-[26px] leading-[1.15] font-bold">Dzień dobry, {name.split(" ")[0]}</h1>
        </div>
        <button
          type="button"
          onClick={() => setNotifications(true)}
          aria-label="Powiadomienia"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-df-panel text-df-text"
        >
          <Icon size={20}>
            <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7.5 2 7.5H4S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />
          </Icon>
        </button>
      </header>

      <section aria-label="Wskaźniki dnia" className="flex gap-2.5">
        {[
          { value: data.active.inProgress, label: "w trakcie", color: "text-df-lime" },
          { value: data.active.ready, label: "do odbioru", color: "text-df-blue" },
          { value: `${data.occupancy.percent}%`, label: "obłożenie", color: "text-df-text" },
        ].map((kpi) => (
          <div key={kpi.label} className="min-w-0 flex-1 rounded-[18px] bg-df-panel px-4 py-3.5">
            <p className={`text-2xl leading-[1.3] font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="truncate text-df-label text-df-muted">{kpi.label}</p>
          </div>
        ))}
      </section>

      {featured && stageName ? (
        <section aria-labelledby="m-featured" className="overflow-hidden rounded-[18px] bg-df-panel pb-4">
          <div aria-hidden="true" className="flex h-[150px] items-center justify-center bg-df-raised text-df-muted">
            <Icon size={40}>
              <path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2M7.5 12.5h.01M16.5 12.5h.01" />
            </Icon>
          </div>
          <div className="flex flex-col gap-2.5 px-4 pt-3.5">
            <div className="flex items-center justify-between gap-2.5">
              <p className="text-df-label font-semibold text-df-muted">Na warsztacie · {featured.bay}</p>
              <Badge className="h-[25px]" />
            </div>
            <h2 id="m-featured" className="text-xl font-bold">
              <Link href={`/orders/${encodeURIComponent(featured.number)}`}>{featured.vehicle}</Link>
            </h2>
            <p className="text-df-body text-df-muted">
              {featured.service} · {featured.customer}
            </p>
            <div
              role="progressbar"
              aria-label={`Postęp zlecenia ${featured.vehicle}`}
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={featured.stage}
              aria-valuetext={`Etap ${featured.stage} z 4 — ${stageName}`}
              className="flex gap-1.5"
            >
              {STAGES.map((stage, index) => (
                <div key={stage} className={`h-1.5 flex-1 rounded-[3px] ${index < featured.stage ? "bg-df-lime" : "bg-df-line"}`} />
              ))}
            </div>
            <div>
              <p className="text-df-body font-medium">
                Etap {featured.stage} z 4 · {stageName}
              </p>
              {nextStage && <p className="text-[11px] text-df-muted">Dalej: {nextStage}</p>}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => act(featured.id, "advance")}
                className="h-12 rounded-[14px] bg-df-lime px-[18px] text-df-label font-semibold text-df-bg"
              >
                Zakończ: {stageName}
              </button>
              <Link
                href={`/orders/${encodeURIComponent(featured.number)}?tab=zdjecia`}
                className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-df-raised px-[18px] text-[15px] font-semibold"
              >
                <Icon size={18}>
                  <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                </Icon>
                Zdjęcie
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[18px] bg-df-panel p-4">
          <h2 className="text-df-section">Na warsztacie</h2>
          <p className="mt-2 text-df-body text-df-muted">Brak aut w trakcie pracy w boksach na dziś.</p>
        </section>
      )}

      <div className="flex items-center justify-between gap-2.5">
        <h2 className="text-df-section">Dzisiejsze zlecenia</h2>
        <Link href="/orders" className="text-df-strong">
          Wszystkie
        </Link>
      </div>
      {orders.length > 0 ? (
        <ul className="rounded-[18px] bg-df-panel px-4 py-1">
          {orders.map((order, index) => (
            <li key={order.number} className={`flex items-center gap-3 py-3 ${index > 0 ? "border-t border-df-line" : ""}`}>
              <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-df-raised text-df-muted">
                <Icon size={20}>
                  <path d="M5 16V11l2-5h10l2 5v5M3 16h18M7 16v2M17 16v2" />
                </Icon>
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/orders/${encodeURIComponent(order.number)}`} className="block truncate text-[15px] font-semibold">{order.vehicle}</Link>
                <p className="line-clamp-2 text-df-label text-df-muted">{rowDetail(order)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge variant={order.status} className="h-[25px]" />
                <p className="text-df-label text-df-muted">{timeLabel(order)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[18px] bg-df-panel p-4 text-df-body text-df-muted">Na dziś nie ma więcej zaplanowanych zleceń.</p>
      )}

      {alerts.coatingClients > 0 && (
        <Link href="/customers" className="flex flex-col gap-1.5 rounded-[18px] bg-df-retry-surface p-4">
          <span className="flex items-center gap-2.5 text-df-strong text-df-retry">
            <Icon size={18}>
              <path d="M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01" />
            </Icon>
            Serwis ceramiki · {alerts.coatingClients} {alerts.coatingClients === 1 ? "klient" : "klientów"}
          </span>
          <span className="text-df-label text-df-muted">Zaległy termin lub w ciągu 7 dni</span>
        </Link>
      )}
      {alerts.rejected.map((invoice) => (
        <Link key={invoice.id} href="/invoices?filter=attention" className="flex flex-col gap-1.5 rounded-[18px] bg-df-error-surface p-4">
          <span className="text-df-strong text-df-error">Faktura odrzucona przez KSeF</span>
          <span className="text-df-label text-df-muted">
            {invoice.number} · {invoice.ksefEnv === "test" ? "TEST" : "PROD"} · Napraw
          </span>
        </Link>
      ))}

      <Sheet open={notifications} onClose={() => setNotifications(false)} title="Powiadomienia">
        {alerts.coatingClients > 0 && <Link href="/customers" onClick={() => setNotifications(false)}>Serwis ceramiki · {alerts.coatingClients} klientów</Link>}
        {alerts.rejected.map(invoice => <Link key={invoice.id} href="/invoices?filter=attention" onClick={() => setNotifications(false)}>Faktura odrzucona przez KSeF · {invoice.number} · {invoice.ksefEnv === "test" ? "TEST" : "PROD"}</Link>)}
        {alerts.coatingClients === 0 && alerts.rejected.length === 0 && <p>Brak alertów wymagających uwagi.</p>}
      </Sheet>

      <Sheet open={notice !== null} onClose={() => setNotice(null)} title={notice?.title ?? ""}>
        <p className="text-df-body text-df-muted">{notice?.description}</p>
        <button type="button" onClick={() => setNotice(null)} className="h-11 rounded-lg bg-df-raised text-df-body font-medium">
          Zamknij
        </button>
      </Sheet>
    </div>
  );
}
