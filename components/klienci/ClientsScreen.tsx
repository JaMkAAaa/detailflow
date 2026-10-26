import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { formatPln } from "@/components/pulpit/demo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLIENTS_PER_PAGE, clientsHref, type ClientFilter } from "@/src/server/klienci/query";
import type { ClientsPage } from "@/src/server/klienci/directory";
import { ClientProfileCard } from "./ClientProfileCard";
import { SoonButton } from "./SoonButton";
import { clientsLabel, formatDate, pageItems, vehiclesLabel } from "./format";

const filters: { value: ClientFilter; label: string }[] = [
  { value: "all", label: "Wszyscy" },
  { value: "regular", label: "Stali klienci" },
  { value: "coating", label: "Serwis powłoki" },
];

const columns = ["KLIENT", "AUTA / REJESTRACJA", "OSTATNIA WIZYTA", "ŁĄCZNA WARTOŚĆ"];
const pageLink =
  "flex size-8 items-center justify-center rounded-md text-df-label tabular-nums hover:bg-df-hover focus-visible:outline-offset-0";

function Pagination({ data }: { data: ClientsPage }) {
  const { query, page, pages } = data;
  const href = (target: number) => clientsHref({ ...query, page: target });
  const first = (page - 1) * CLIENTS_PER_PAGE + 1;
  const last = first + data.rows.length - 1;
  return (
    <div className="flex min-h-10 items-start gap-3">
      <p role="status" className="min-w-0 flex-1 truncate pt-px text-df-label text-df-muted">
        {data.rows.length > 0
          ? `${first}–${last} z ${clientsLabel(data.total)} · ${CLIENTS_PER_PAGE} na stronę`
          : "Brak klientów na tej stronie"}
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

function Directory({ data }: { data: ClientsPage }) {
  const { query, rows } = data;
  const selectedId = data.selected?.id;
  const filtering = query.q !== "" || query.filter !== "all";

  return (
    <section aria-labelledby="clients-heading" className="flex min-h-[734px] min-w-0 flex-col gap-2 rounded-xl bg-df-panel p-5">
      <div className="flex h-7 items-center gap-2">
        <h2 id="clients-heading" className="min-w-0 flex-1 truncate text-df-section">Baza klientów</h2>
        <p className="shrink-0 text-df-label text-df-muted">
          {clientsLabel(data.total)} · {vehiclesLabel(data.vehicleTotal)}
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState
          className="my-auto"
          title={query.q ? `Nie znaleziono „${query.q}”` : "Brak klientów"}
          description={
            filtering
              ? "Zmień lub wyczyść filtry i spróbuj ponownie. Sprawdź też pisownię nazwiska, numeru telefonu lub rejestracji."
              : "Dodaj pierwszego klienta, a pojawi się tutaj razem z autami i historią wizyt."
          }
          // Local decorative Figma SVG, preserving its original geometry.
          // eslint-disable-next-line @next/next/no-img-element
          icon={<img src="/states/search.svg" width={28} height={28} alt="" />}
          actions={
            filtering ? (
              <Link href={clientsHref({})} className={buttonVariants({ variant: "secondary" })}>Wyczyść filtry</Link>
            ) : undefined
          }
        />
      ) : (
        // Nagłówek tabeli jest sticky wewnątrz przewijanego obszaru, więc kolumny zawsze się zgadzają.
          <div tabIndex={0} aria-label="Lista klientów" className="h-[549px] overflow-x-clip overflow-y-auto">
            <table className="w-full table-fixed border-separate border-spacing-0 text-left">
              <caption className="sr-only">Klienci studia, strona {data.page} z {data.pages}</caption>
              <colgroup>
                <col className="w-[33%]" />
                <col className="w-[16%]" />
                <col className="w-[24%]" />
                <col className="w-[27%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-df-panel">
                <tr className="h-[29px] text-df-label text-df-muted">
                  {columns.map((heading, index) => (
                    <th key={heading} scope="col" className={cn("border-b border-df-line pb-2 align-top font-medium", index === 0 && "pl-2.5")}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr aria-hidden="true"><td colSpan={4} className="h-2 p-0" /></tr>
                {rows.map((client) => {
                  const selected = client.id === selectedId;
                  const cell = cn("h-[52px] py-1", selected && "bg-df-raised");
                  return (
                    <tr key={client.id} className="relative">
                      <td className={cn(cell, "rounded-l-lg pl-2", selected ? "border-l-2 border-df-lime" : "pl-2.5")}>
                        <Link
                          href={clientsHref({ ...query, client: client.id })}
                          aria-current={selected ? "true" : undefined}
                          className="block min-w-0 after:absolute after:inset-0 after:rounded-lg hover:after:bg-df-hover/40 focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-df-lime focus-visible:outline-none"
                        >
                          <span className="block truncate text-df-strong text-df-text">{client.name}</span>
                          <span className="mt-0.5 block truncate text-df-label text-df-muted">{client.phone ?? "Brak telefonu"}</span>
                        </Link>
                      </td>
                      <td className={cn(cell, "pr-2 text-df-label font-normal text-df-muted")}>
                        <span className="block truncate">
                          {client.plates[0] ?? "—"}
                          {client.plates.length > 1 && ` +${client.plates.length - 1}`}
                        </span>
                      </td>
                      <td className={cn(cell, "pr-2 text-df-body text-df-muted")}>
                        {client.lastVisit ? formatDate(client.lastVisit) : "—"}
                      </td>
                      <td className={cn(cell, "rounded-r-lg pr-2 text-df-strong whitespace-nowrap text-df-text")}>
                        {formatPln(client.totalGross)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      )}
      <div className="mt-auto pt-2">
        <Pagination data={data} />
      </div>
    </section>
  );
}

function Filters({ data }: { data: ClientsPage }) {
  const { query, counts } = data;
  return (
    <div className="flex min-h-11 flex-wrap items-start gap-3">
      <form action="/customers" role="search" className="relative w-[340px] max-w-full shrink-0">
        <span aria-hidden="true" className="pointer-events-none absolute top-0 left-3.5 flex h-10 items-center text-df-label text-df-muted">⌕</span>
        {query.filter !== "all" && <input type="hidden" name="filter" value={query.filter} />}
        <input
          key={query.q}
          type="search"
          name="q"
          defaultValue={query.q}
          maxLength={80}
          aria-label="Szukaj klienta"
          placeholder="Szukaj nazwiska, telefonu lub rejestracji…"
          className="h-10 w-full rounded-lg bg-df-raised pr-3 pl-9 text-df-label text-df-text placeholder:text-df-text/60"
        />
      </form>
      <div role="group" aria-label="Filtr klientów" className="flex flex-wrap gap-3">
        {filters.map(({ value, label }) => {
          const active = query.filter === value;
          return (
            <Link
              key={value}
              href={clientsHref({ q: query.q, filter: value })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "inline-flex h-7 items-center whitespace-pre rounded-md border px-2.5 text-df-label",
                active ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-raised text-df-text hover:bg-df-hover",
              )}
            >
              {label}
              {"  "}
              {counts[value]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ClientsScreen({ data }: { data: ClientsPage }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-h-[70px] items-start justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Klienci i auta</h1>
          <p className="mt-1 text-df-body text-df-muted">Relacje, które wracają. Pełna historia każdego samochodu.</p>
        </div>
        <SoonButton
          className="h-10 w-[190px] text-df-label"
          title="Dodaj klienta — wkrótce"
          description="Dodawanie klientów z poziomu panelu będzie dostępne w kolejnym etapie."
        >
          ＋ Dodaj klienta
        </SoonButton>
      </div>
      <Filters data={data} />
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_378px]">
        <Directory data={data} />
        <ClientProfileCard profile={data.selected} />
      </div>
    </div>
  );
}
