"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states/empty-state";
import { NoResultsState } from "@/components/states/no-results-state";
import { formatPln, type TodayOrder } from "./demo";

const filters = [
  { value: "all", label: "Wszystkie" },
  { value: "in-progress", label: "W trakcie" },
  { value: "ready-for-pickup", label: "Do odbioru" },
] as const;

export function OrdersToday({
  orders,
  onOpenOrder,
}: {
  orders: TodayOrder[];
  onOpenOrder: (order: TodayOrder) => void;
}) {
  const [filter, setFilter] = useState<string>("all");
  const visible = orders.filter(
    (order) => filter === "all" || order.status === filter,
  );
  return (
    <section
      aria-labelledby="today-title"
      className="rounded-xl bg-df-panel p-5"
    >
      <div className="flex h-7 items-center justify-between gap-2">
        <h2 id="today-title" className="text-df-section">
          Zlecenia na dziś
        </h2>
        <Link
          href="/orders"
          className="text-df-label text-df-muted hover:text-df-text"
        >
          Wszystkie zlecenia ↗
        </Link>
      </div>
      <div
        role="group"
        aria-label="Filtruj zlecenia na dziś"
        className="mt-3 flex h-[30px] gap-2"
      >
        {filters.map(({ value, label }) => (
          <button
            key={value}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={`h-7 rounded-md border px-2.5 text-df-label ${filter === value ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-raised text-df-muted hover:bg-df-hover"}`}
          >
            {label}{" "}
            <span className="ml-1">
              {value === "all"
                ? orders.length
                : orders.filter((order) => order.status === value).length}
            </span>
          </button>
        ))}
      </div>
      {orders.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title="Na dziś wszystko gotowe"
          description="Nie masz jeszcze zleceń zaplanowanych na dzisiaj."
        />
      ) : visible.length === 0 ? (
        <NoResultsState
          headingLevel={3}
          onClearFilters={() => setFilter("all")}
        />
      ) : (
        <table className="mt-3 w-full table-fixed text-left">
          <caption className="sr-only">
            Zlecenia na dziś —{" "}
            {filters.find((item) => item.value === filter)?.label}
          </caption>
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[26%]" />
            <col className="w-[22%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead className="h-8 border-b border-df-line text-df-label text-df-muted">
            <tr>
              {["AUTO / KLIENT", "USŁUGA", "STATUS", "WARTOŚĆ"].map((label) => (
                <th key={label} scope="col" className="pb-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr key={order.number} className="h-[59px]">
                <td className="pr-2">
                  <button
                    onClick={() => onOpenOrder(order)}
                    className="text-left hover:text-df-lime"
                  >
                    <span className="block text-df-strong">
                      {order.vehicle}
                    </span>
                    <span className="mt-px block text-df-label text-df-muted">
                      {order.customer} · {order.plate}
                    </span>
                  </button>
                </td>
                <td className="pr-2 text-df-body text-df-muted">
                  {order.service}
                </td>
                <td>
                  <Badge
                    variant={order.status}
                    className="px-2 text-[11px] min-[1400px]:px-2.5 min-[1400px]:text-df-label"
                  />
                </td>
                <td className="whitespace-nowrap text-df-strong">
                  {formatPln(order.grossPln)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
