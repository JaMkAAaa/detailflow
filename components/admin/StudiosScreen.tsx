import Link from "next/link";
import { formatDate, pageItems } from "@/components/klienci/format";
import { formatPln } from "@/components/pulpit/demo";
import { EmptyState } from "@/components/states/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  FILTER_LABEL,
  STATUS_LABEL,
  STUDIO_ACCOUNT_FILTERS,
  STUDIOS_PER_PAGE,
  studiosExportHref,
  studiosHref,
  type StudioAccountFilter,
} from "@/src/server/admin/accounts";
import type { StudiosPage } from "@/src/server/admin/directory";
import { BILLING_PLANS } from "@/src/server/billing/plans";
import type { StudioStatus } from "@/lib/db/generated/client";

const statusVariant: Record<StudioStatus, "completed" | "scheduled" | "overdue" | "error" | "draft"> = {
  active: "completed",
  trial: "scheduled",
  past_due: "overdue",
  suspended: "error",
  canceled: "draft",
};

const columns = ["STUDIO", "STATUS", "PLAN", "OSTATNIA AKTYWNOŚĆ", "ABONAMENT"];
const pageLink = "flex size-8 items-center justify-center rounded-md text-df-label tabular-nums hover:bg-df-hover focus-visible:outline-offset-0";

function Filters({ data }: { data: StudiosPage }) {
  const { query, counts } = data;
  return (
    <div className="flex min-h-11 flex-wrap items-start gap-3">
      <form action="/admin/studios" role="search" className="relative w-[340px] max-w-full shrink-0">
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-3.5 flex h-10 items-center text-df-label text-df-muted">⌕</span>
        {query.filter !== "all" && <input type="hidden" name="filter" value={query.filter} />}
        <input
          key={query.q}
          type="search"
          name="q"
          defaultValue={query.q}
          maxLength={80}
          aria-label="Szukaj studia"
          placeholder="Szukaj nazwy, kodu, miasta lub e-maila…"
          className="h-10 w-full rounded-lg bg-df-raised pr-3 pl-9 text-df-label text-df-text placeholder:text-df-text/60"
        />
      </form>
      <div role="group" aria-label="Status konta" className="flex flex-wrap gap-3">
        {STUDIO_ACCOUNT_FILTERS.map((value) => {
          const active = query.filter === value;
          return (
            <Link
              key={value}
              href={studiosHref({ q: query.q, filter: value })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-7 items-center whitespace-pre rounded-md border px-2.5 text-df-label",
                active ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-raised text-df-text hover:bg-df-hover",
              )}
            >
              {FILTER_LABEL[value]}
              {"  "}
              {counts[value]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Pagination({ data }: { data: StudiosPage }) {
  const { query, page, pages } = data;
  const href = (target: number) => studiosHref({ ...query, page: target });
  const first = data.rows.length === 0 ? 0 : (page - 1) * STUDIOS_PER_PAGE + 1;
  const last = first + data.rows.length - 1;
  return (
    <div className="flex min-h-10 items-start gap-3">
      <p role="status" className="min-w-0 flex-1 truncate pt-px text-df-label text-df-muted">
        {data.rows.length > 0 ? `${first}–${last} z ${data.total} · ${STUDIOS_PER_PAGE} na stronę` : "Brak studiów na tej stronie"}
      </p>
      {pages > 1 && (
        <nav aria-label="Stronicowanie" className="flex h-10 shrink-0 items-center gap-0.5 rounded-lg bg-df-raised px-1.5">
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Poprzednia strona" className={pageLink}>‹</Link>
          ) : (
            <span aria-hidden="true" className={cn(pageLink, "opacity-40 hover:bg-transparent")}>‹</span>
          )}
          {pageItems(page, pages).map((item, index) =>
            item === "…" ? (
              <span key={`gap-${index}`} aria-hidden="true" className="flex size-8 items-center justify-center text-df-label text-df-muted">…</span>
            ) : (
              <Link
                key={item}
                href={href(item)}
                aria-label={`Strona ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(pageLink, item === page ? "bg-df-line text-df-text" : "text-df-muted")}
              >
                {item}
              </Link>
            ),
          )}
          {page < pages ? (
            <Link href={href(page + 1)} aria-label="Następna strona" className={pageLink}>›</Link>
          ) : (
            <span aria-hidden="true" className={cn(pageLink, "opacity-40 hover:bg-transparent")}>›</span>
          )}
        </nav>
      )}
    </div>
  );
}

function summary(filter: StudioAccountFilter, total: number, all: number) {
  if (filter === "all") return `${all} kont`;
  return `${total} z ${all} kont · ${FILTER_LABEL[filter]}`;
}

export function StudiosScreen({ data }: { data: StudiosPage }) {
  const { query, rows, counts } = data;
  const filtering = query.q !== "" || query.filter !== "all";
  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-[70px] flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Studia</h1>
          <p className="mt-1 text-df-body text-df-muted">{summary(query.filter, data.total, counts.all)}</p>
        </div>
        <a href={studiosExportHref(query)} className={cn(buttonVariants({ variant: "secondary" }), "h-10 text-df-label")}>
          CSV
        </a>
      </div>
      <Filters data={data} />
      <section aria-labelledby="studios-heading" className="flex min-h-[480px] min-w-0 flex-col gap-2 rounded-xl bg-df-panel p-5">
        <h2 id="studios-heading" className="sr-only">Lista studiów</h2>
        {rows.length === 0 ? (
          <EmptyState
            className="my-auto"
            title={query.q ? `Nie znaleziono „${query.q}”` : "Brak studiów"}
            description={
              filtering
                ? "Zmień lub wyczyść filtry i spróbuj ponownie."
                : "Gdy pojawi się pierwsze studio, zobaczysz je tutaj."
            }
            actions={
              filtering ? (
                <Link href="/admin/studios" className={buttonVariants({ variant: "secondary" })}>Wyczyść filtry</Link>
              ) : undefined
            }
          />
        ) : (
          <div tabIndex={0} aria-label="Lista studiów" className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left">
              <caption className="sr-only">Studia, strona {data.page} z {data.pages}</caption>
              <thead>
                <tr className="h-[29px] text-df-label text-df-muted">
                  {columns.map((heading, index) => (
                    <th key={heading} scope="col" className={cn("border-b border-df-line pb-2 font-medium", index === 0 && "pl-2.5")}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr aria-hidden="true"><td colSpan={5} className="h-2 p-0" /></tr>
                {rows.map((studio) => (
                  <tr key={studio.publicCode} className="relative">
                    <td className="h-[52px] rounded-l-lg py-1 pl-2.5">
                      <Link
                        href={`/admin/studios/${studio.publicCode}`}
                        className="block min-w-0 after:absolute after:inset-0 after:rounded-lg hover:after:bg-df-hover/40 focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-df-lime focus-visible:outline-none"
                      >
                        <span className="block truncate text-df-strong text-df-text">{studio.name}</span>
                        <span className="mt-0.5 block truncate text-df-label text-df-muted">
                          {studio.publicCode}
                          {studio.city ? ` · ${studio.city}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="py-1 pr-3">
                      <Badge variant={statusVariant[studio.status]}>{STATUS_LABEL[studio.status]}</Badge>
                    </td>
                    <td className="py-1 pr-3 text-df-body text-df-text">{BILLING_PLANS[studio.plan].name}</td>
                    <td className="py-1 pr-3 text-df-body text-df-muted">{formatDate(studio.lastActivityAt)}</td>
                    <td className="rounded-r-lg py-1 pr-2 text-df-strong whitespace-nowrap text-df-text">
                      {studio.subscriptionNet ? `${formatPln(studio.subscriptionNet)} / ${studio.billingInterval === "yearly" ? "rok" : "mies."}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-auto pt-2">
          <Pagination data={data} />
        </div>
      </section>
    </div>
  );
}
