"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kpis } from "./kpis";
import { LiveSchedule } from "./live-schedule";
import { useDashboardActions, type DashboardProps } from "./use-dashboard-actions";
import { OrdersToday } from "./orders-today";

export function Dashboard({ data, name, studioId, canInvoice }: DashboardProps) {
  const featured = data.featured;
  const dialog = useRef<HTMLDialogElement>(null);
  const { notice, setNotice, busy, act } = useDashboardActions(studioId);
  useEffect(() => { if (notice) dialog.current?.showModal(); }, [notice]);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-[66px] items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-df-headline">
            Dzień dobry, {name.split(" ")[0]}.
          </h1>
          <p className="mt-1 text-df-body text-df-muted">
            {data.dateLabel} · {data.plan.bookings.length} aut w planie boksów ·{" "}
            {data.active.ready} do odbioru
          </p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <Link href="/quotes/new" className={buttonVariants({ variant: "secondary", className: "h-10 px-[18px] text-df-label" })}>
            Nowa wycena
          </Link>
          {canInvoice ? <Link href="/invoices/new" className={buttonVariants({ variant: "secondary", className: "h-10 px-[18px] text-df-label" })}>Wystaw fakturę</Link> : <Button variant="secondary" onClick={() => setNotice({ title: "Wystaw fakturę", description: "Faktury wystawia właściciel lub manager po zakończeniu zlecenia." })}>Wystaw fakturę</Button>}
          <Link href="/orders?new=1" className={buttonVariants({ className: "h-10 px-[18px] text-df-label" })}>+ Nowe zlecenie</Link>
        </div>
      </div>
      <Kpis data={data} />
      <div className="grid grid-cols-[minmax(0,2.016fr)_minmax(300px,1fr)] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <LiveSchedule data={data} />
          <OrdersToday orders={data.todayOrders} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {featured ? (
            <section
              aria-labelledby="featured-title"
              className="flex flex-col gap-3 rounded-xl bg-df-panel p-5 pb-3.5"
            >
              <div className="flex h-7 items-center justify-between">
                <h2 id="featured-title" className="text-df-section">
                  Na warsztacie
                </h2>
                <Link href={`/orders/${encodeURIComponent(featured.number)}`} aria-label={`Opcje ${featured.vehicle}`} className="rounded px-1 text-df-muted hover:bg-df-raised">•••</Link>
              </div>
              <div className="h-11">
                <h3 className="text-df-section"><Link href={`/orders/${encodeURIComponent(featured.number)}`}>{featured.vehicle}</Link></h3>
                <p className="mt-0.5 text-df-label text-df-muted">
                  #{featured.number} · {featured.customer} · {featured.bay}
                </p>
              </div>
              <div className="flex h-[52px] shrink-0 flex-col gap-2 text-df-label">
                <div className="flex h-5 shrink-0 justify-between gap-2">
                  <span>{featured.service}</span>
                  <span className="text-df-lime">
                    Etap {featured.stage} z 4
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Postęp zlecenia ${featured.vehicle}`}
                  aria-valuemin={0}
                  aria-valuemax={4}
                  aria-valuenow={featured.stage}
                  aria-valuetext={`Etap ${featured.stage} z 4 — ${featured.service}`}
                  className="h-1 shrink-0 overflow-hidden rounded-sm bg-df-raised"
                >
                  <div
                    className="h-full bg-df-lime"
                    style={{ width: `${(featured.stage / 4) * 100}%` }}
                  />
                </div>
                <p className="text-df-muted">
                  Planowany odbiór:{" "}
                  {featured.dueAt
                    ? new Intl.DateTimeFormat("pl-PL", {
                        timeZone: "Europe/Warsaw",
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(featured.dueAt))
                    : "nie ustalono"}
                </p>
              </div>
              <div className="flex gap-2.5">
                <Link href={`/orders/${encodeURIComponent(featured.number)}`} className={buttonVariants({ variant: "secondary", className: "h-[38px] min-w-0 flex-1 px-2 text-df-label" })}>Szczegóły zlecenia</Link>
                <Button variant="secondary" disabled={busy} className="h-[38px] min-w-0 flex-1 px-2 text-df-label" onClick={() => act(featured.id, "portal-links")}>Link dla klienta ↗</Button>
              </div>
            </section>
          ) : (
            <section className="rounded-xl bg-df-panel p-5">
              <h2 className="text-df-section">Na warsztacie</h2>
              <p className="mt-3 text-df-muted">
                Brak aut w trakcie pracy w boksach na dziś.
              </p>
            </section>
          )}
          <section
            aria-labelledby="attention-title"
            className="flex flex-col gap-3.5 rounded-xl bg-df-panel p-5"
          >
            <div className="flex h-7 items-center justify-between">
              <h2 id="attention-title" className="text-df-section">
                Wymaga uwagi
              </h2>
              <span className="text-df-label text-df-muted">
                {data.alerts.rejected.length + data.alerts.chemicals.length +
                  (data.alerts.coatingClients > 0 ? 1 : 0)}
              </span>
            </div>
            {data.alerts.coatingClients > 0 && (
              <div>
                <h3 className="text-df-strong">
                  Serwis ceramiki · {data.alerts.coatingClients} klientów
                </h3>
                <p className="mt-1 text-df-label text-df-muted">
                  Zaległy termin lub w ciągu 7 dni.{" "}
                  <Link href="/customers">Zobacz ↗</Link>
                </p>
              </div>
            )}
            {data.alerts.chemicals.map(item => (
              <Link key={item.id} href="/inventory" className="border-t border-df-line pt-3">
                <h3 className="text-df-strong text-df-amber">Niski stan chemii · {item.name}</h3>
                <p className="mt-1 text-df-label text-df-muted">{item.quantity} {item.unit === "ml" ? "ml" : "szt."} · próg: {item.lowThreshold} · Magazyn ↗</p>
              </Link>
            ))}
            {data.alerts.rejected.map((invoice) => (
              <Link
                key={invoice.id}
                href="/invoices?filter=attention"
                className="border-t border-df-line pt-3"
              >
                <h3 className="text-df-strong text-df-error">
                  Faktura odrzucona przez KSeF
                </h3>
                <p className="mt-1 text-df-label text-df-muted">
                  {invoice.number} ·{" "}
                  {invoice.ksefEnv === "test" ? "TEST" : "PROD"} · Napraw ↗
                </p>
              </Link>
            ))}
            {data.alerts.rejected.length === 0 &&
              data.alerts.coatingClients === 0 && data.alerts.chemicals.length === 0 && (
                <p className="text-df-label text-df-muted">
                  Brak alertów wymagających uwagi.
                </p>
              )}
          </section>
        </div>
      </div>
      <dialog
        ref={dialog}
        onClose={() => setNotice(null)}
        aria-labelledby="dashboard-dialog-title"
        aria-describedby="dashboard-dialog-description"
        className="fixed inset-0 m-auto w-[440px] max-w-[calc(100%-32px)] rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60"
      >
        <h2 id="dashboard-dialog-title" className="text-df-section">
          {notice?.title}
        </h2>
        <p
          id="dashboard-dialog-description"
          className="mt-3 text-df-body text-df-muted"
        >
          {notice?.description}
        </p>
        <form method="dialog" className="mt-5 flex justify-end">
          <Button type="submit" variant="secondary">
            Zamknij
          </Button>
        </form>
      </dialog>
    </div>
  );
}
