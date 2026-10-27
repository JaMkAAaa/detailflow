import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { NoResultsState } from "@/components/states/no-results-state";
import { MobileHeader } from "@/components/studio/MobileHeader";
import { cn } from "@/lib/utils";
import { date, envLabel, invoiceHref, money, type Environment } from "./model";
import {
  matchesInvoiceFilter,
  requiresKsefAttention,
  type InvoiceFilter,
  type InvoiceRow,
} from "./list-model";
import { InvoiceStatus } from "./InvoiceStatus";
import { EnvironmentBanner } from "./shared";

export function MobileInvoices({
  invoices,
  env,
  now,
  visible,
  query,
  filter,
  setQuery,
  setFilter,
  page,
  pages,
  setPage,
  total,
}: {
  invoices: InvoiceRow[];
  env: Environment;
  now: string;
  visible: InvoiceRow[];
  query: string;
  filter: InvoiceFilter;
  setQuery: (value: string) => void;
  setFilter: (value: InvoiceFilter) => void;
  page: number;
  pages: number;
  setPage: (value: number) => void;
  total: number;
}) {
  const rejected = invoices.filter((row) => row.ksefStatus === "rejected");
  return (
    <div className="space-y-4 leading-[normal]">
      <MobileHeader
        title="Faktury"
        subtitle={new Intl.DateTimeFormat("pl-PL", {
          timeZone: "Europe/Warsaw",
          month: "long",
          year: "numeric",
        }).format(new Date(now))}
        back="/more"
        action={
          <span className="rounded-md bg-df-amber-dark px-2 py-1 text-[11px] font-bold text-df-amber">
            KSeF {envLabel(env)}
          </span>
        }
      />
      <EnvironmentBanner env={env} compact />
      <div className="grid grid-cols-3 gap-2">
        {[
          {
            label: "wystawione",
            value: invoices.filter((row) => row.status === "issued").length,
            color: "text-df-text",
          },
          {
            label: "w KSeF",
            value: invoices.filter(
              (row) => row.status === "issued" && row.ksefStatus === "accepted",
            ).length,
            color: "text-df-lime",
          },
          {
            label: "do uwagi",
            value: invoices.filter(requiresKsefAttention).length,
            color: "text-df-amber",
          },
        ].map((item) => (
          <button
            type="button"
            key={item.label}
            onClick={() =>
              setFilter(
                item.label === "do uwagi"
                  ? "attention"
                  : item.label === "w KSeF"
                    ? "accepted"
                    : "all",
              )
            }
            className="rounded-[18px] bg-df-panel px-4 py-3 text-left"
          >
            <span className={`block text-[24px] font-bold ${item.color}`}>
              {item.value}
            </span>
            <span className="text-[12px] text-df-muted">{item.label}</span>
          </button>
        ))}
      </div>
      {!!rejected.length && (
        <Link
          href="/invoices/attention"
          className="flex items-center justify-between gap-3 rounded-[14px] bg-df-error-surface p-3.5"
        >
          <span className="min-w-0">
            <strong className="block text-[14px]">
              KSeF odrzucił {rejected[0]!.number}
            </strong>
            <span className="block text-[12px] text-df-error">
              {rejected[0]!.events.find((event) => event.kind === "rejected")
                ?.message ?? "Dokument wymaga uwagi"}
            </span>
          </span>
          <span className="text-[13px] font-semibold text-df-error">
            Napraw
          </span>
        </Link>
      )}
      <div
        role="group"
        aria-label="Filtry faktur"
        className="flex flex-wrap gap-2"
      >
        {(
          [
            ["all", "Wszystkie"],
            ["accepted", "Przyjęte"],
            ["processing", "Przetwarzanie"],
            ["attention", "Wymagają uwagi"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={cn(
              "min-h-9 rounded-full border px-3 text-[13px] font-semibold",
              filter === key
                ? "border-df-muted bg-df-line"
                : "border-transparent bg-df-panel text-df-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="sr-only">Szukaj faktury</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Szukaj numeru, nabywcy, NIP…"
          className="h-11 w-full min-w-0 rounded-xl bg-df-panel px-4 text-[13px]"
        />
      </label>
      {!visible.length ? (
        <NoResultsState
          query={query}
          description={
            invoices.length
              ? undefined
              : "Nie ma jeszcze faktur w tym środowisku KSeF."
          }
          onClearFilters={() => {
            setQuery("");
            setFilter("all");
          }}
        />
      ) : (
        <ul
          aria-label="Lista faktur"
          className="rounded-[18px] bg-df-panel px-4 py-1"
        >
          {visible.map((row) => (
            <li key={row.id} className="border-b border-df-line last:border-0">
              <Link
                href={invoiceHref(row.number, env)}
                className="flex min-h-[76px] items-center justify-between gap-2 py-3"
              >
                <span className="min-w-0 flex-1">
                  <strong className="block break-words text-[15px] font-semibold">
                    {row.buyerName}
                  </strong>
                  <span className="text-[12px] text-df-muted">
                    {row.status === "draft" ? "Szkic" : row.number} ·{" "}
                    {date(row.issuedAt)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <strong className="text-[15px]">
                    {money(row.totalGross)}
                  </strong>
                  <InvoiceStatus invoice={row} />
                  {matchesInvoiceFilter(row, "overdue", now) && (
                    <Badge variant="overdue">Po terminie</Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > 0 && (
        <nav
          aria-label="Strony faktur"
          className="flex items-center justify-between text-[13px] text-df-muted"
        >
          <button
            type="button"
            aria-label="Poprzednia strona"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="min-h-11 px-3 disabled:opacity-40"
          >
            ‹
          </button>
          <span aria-live="polite">
            Strona {page} z {pages} · {total} faktur
          </span>
          <button
            type="button"
            aria-label="Następna strona"
            disabled={page === pages}
            onClick={() => setPage(page + 1)}
            className="min-h-11 px-3 disabled:opacity-40"
          >
            ›
          </button>
        </nav>
      )}
      <Link
        href="/invoices/new"
        className="flex min-h-12 items-center justify-center rounded-[14px] bg-df-lime font-semibold text-df-bg"
      >
        + Wystaw fakturę
      </Link>
    </div>
  );
}
