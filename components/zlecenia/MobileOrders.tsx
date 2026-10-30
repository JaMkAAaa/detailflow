"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPln } from "@/lib/format-pln";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { EmptyState, NoResultsState } from "@/components/states";
import { cn } from "@/lib/utils";
import { filterOrders, type BoardOrder, type OrderStatus } from "./board-demo";

type ActiveStatus = Exclude<OrderStatus, "completed" | "canceled">;

/** Kolejność grup jak w Figmie M-03: najpierw to, co wymaga pracy teraz. */
const groups: { status: ActiveStatus; title: string; dot: string }[] = [
  { status: "in_progress", title: "W trakcie", dot: "bg-df-lime" },
  { status: "ready_for_pickup", title: "Do odbioru", dot: "bg-df-blue" },
  { status: "accepted", title: "Przyjęte", dot: "bg-df-muted" },
];
/** Kolejność chipów jak w Figmie. */
const chips: { status: ActiveStatus; title: string }[] = [
  { status: "accepted", title: "Przyjęte" },
  { status: "in_progress", title: "W trakcie" },
  { status: "ready_for_pickup", title: "Do odbioru" },
];

const cardClass = "flex flex-col gap-2.5 rounded-[18px] bg-df-panel p-4 text-left text-df-text";

function OrderCardBody({ order }: { order: BoardOrder }) {
  return (
    <>
      <span className="flex items-center gap-3">
        {order.photo && (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-df-raised">
            <Image src={order.photo} alt={`Zdjęcie: ${order.vehicle}`} fill sizes="56px" className="object-cover" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="truncate text-base font-semibold">{order.vehicle}</span>
          <span className="truncate text-df-label font-normal text-df-muted">
            #{order.number} · {order.customer}
          </span>
          <span className="truncate text-df-body">{order.service}</span>
        </span>
        <MaskIcon name="chevron-right" size={18} className="text-df-muted" />
      </span>
      <span className="h-px w-full bg-df-line" />
      <span className="flex items-center gap-2.5">
        <span className="min-w-0 flex-1 text-df-body text-df-muted">{order.dueLabel}</span>
        <span className="shrink-0 text-[15px] font-bold whitespace-nowrap">{formatPln(order.grossPln)}</span>
      </span>
    </>
  );
}

/**
 * M-03 — lista aktywnych zleceń w układzie telefonu. Dane pochodzą z API zleceń.
 */
export function MobileOrders({ orders }: { orders: BoardOrder[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ActiveStatus | null>(null);
  const active = orders.filter((order) => order.status !== "completed" && order.status !== "canceled");
  const found = filterOrders(active, { query, service: "" });
  const visible = status ? found.filter((order) => order.status === status) : found;
  const count = (value: ActiveStatus) => found.filter((order) => order.status === value).length;

  function clearFilters() {
    setQuery("");
    setStatus(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-df-body font-medium text-df-muted">{active.length} aktywnych</p>
        <div className="flex items-center gap-3"><h1 className="flex-1 text-[26px] leading-[1.15] font-bold">Zlecenia</h1><Link href="/orders/new" className="inline-flex h-10 items-center rounded-lg bg-df-lime px-3 text-df-body font-semibold text-df-bg">＋ Nowe</Link></div>
      </header>

      <label className="flex items-center gap-2.5 rounded-[14px] bg-df-panel px-3.5 py-[13px] text-df-muted">
        <MaskIcon name="search" size={18} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Szukaj auta, klienta, rejestracji"
          placeholder="Szukaj auta, klienta, rejestracji…"
          className="min-w-0 flex-1 bg-transparent text-base text-df-text outline-none placeholder:text-df-muted"
        />
      </label>

      <div role="group" aria-label="Status" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {[{ status: null, title: "Wszystkie", total: found.length }, ...chips.map((chip) => ({ ...chip, total: count(chip.status) }))].map((chip) => (
          <button
            key={chip.status ?? "all"}
            type="button"
            aria-pressed={status === chip.status}
            onClick={() => setStatus(chip.status)}
            className={cn(
              "h-11 shrink-0 rounded-[20px] border px-3 text-df-body font-semibold",
              status === chip.status ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-panel text-df-text",
            )}
          >
            {chip.title} {chip.total}
          </button>
        ))}
      </div>

      {active.length === 0 ? (
        <EmptyState title="Brak aktywnych zleceń" description="Nowe zlecenia pojawią się tutaj po ich utworzeniu." actions={<Link href="/orders/new" className="inline-flex rounded-lg bg-df-lime px-4 py-2 text-df-body font-semibold text-df-bg">＋ Nowe zlecenie</Link>} />
      ) : visible.length === 0 ? (
        <NoResultsState query={query} onClearFilters={clearFilters} />
      ) : (
        groups.map((group) => {
          const items = visible.filter((order) => order.status === group.status);
          if (items.length === 0) return null;
          return (
            <section key={group.status} aria-labelledby={`m-group-${group.status}`} className="flex flex-col gap-2.5">
              <h2 id={`m-group-${group.status}`} className="flex items-center gap-2 text-df-body font-semibold text-df-muted uppercase">
                <span aria-hidden="true" className={cn("size-2 rounded-full", group.dot)} />
                {group.title} · {items.length}
              </h2>
              <ul className="flex flex-col gap-2.5">
                {items.map((order) => (
                  <li key={order.number}>
                    <Link href={`/orders/${order.number}`} className={cardClass}><OrderCardBody order={order} /></Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
