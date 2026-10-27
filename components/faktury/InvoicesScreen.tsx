"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoResultsState } from "@/components/states/no-results-state";
import { cn } from "@/lib/utils";
import { date, envLabel, invoiceHref, money, type Environment } from "./model";
import { isOverdue, isUnpaid, matchesInvoiceFilter, matchesInvoiceSearch, requiresKsefAttention, sumInvoices, type InvoiceFilter, type InvoiceRow } from "./list-model";
import { EnvironmentBanner, Panel } from "./shared";
import { InvoiceStatus } from "./InvoiceStatus";

const filters: { key: InvoiceFilter; label: string }[] = [
  { key: "all", label: "Wszystkie" }, { key: "accepted", label: "Przyjęte" },
  { key: "processing", label: "Przetwarzanie" }, { key: "attention", label: "Wymagają uwagi" },
  { key: "draft", label: "Szkice" }, { key: "unpaid", label: "Nieopłacone" }, { key: "overdue", label: "Po terminie" },
];
const pageSize = 7;

export function InvoicesScreen({ invoices, env, now }: { invoices: InvoiceRow[]; env: Environment; now: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const issued = invoices.filter(row => row.status === "issued");
  const accepted = issued.filter(row => row.ksefStatus === "accepted");
  const attention = invoices.filter(requiresKsefAttention);
  const rejected = attention.filter(row => row.ksefStatus === "rejected");
  const overdue = invoices.filter(row => isOverdue(row, now));
  const unpaid = invoices.filter(isUnpaid);
  const results = invoices.filter(row => matchesInvoiceFilter(row, filter, now) && matchesInvoiceSearch(row, query));
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = results.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  async function copy(number: string) {
    try { await navigator.clipboard.writeText(number); setMessage("Skopiowano pełny numer KSeF."); }
    catch { setMessage("Nie udało się skopiować numeru. Zaznacz go i skopiuj ręcznie."); }
  }
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-[34px] font-bold leading-tight">Faktury</h1><p className="mt-2 text-df-body text-df-muted">{invoices.length} dokumentów · faktury klientów studia</p></div><div className="flex flex-wrap gap-3"><Button variant="secondary" className="h-10 text-df-label" onClick={() => setMessage("Eksport JPK nie jest dostępny w tym podglądzie UI.")}>Eksport JPK</Button><Link href="/invoices/new" className={buttonVariants({ className: "h-10 text-df-label" })}>+ Wystaw fakturę</Link></div></header>
    <EnvironmentBanner env={env} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Panel><p className="text-df-body text-df-muted">Wystawione</p><p className="my-1 text-[28px] font-bold">{issued.length}</p><p className="text-df-label text-df-lime">{accepted.length} przyjętych{env === "test" ? " (test)" : ""}</p></Panel>
      <Panel><p className="text-df-body text-df-muted">Przychód brutto</p><p className="my-1 text-[28px] font-bold">{money(sumInvoices(accepted))}</p><p className="text-df-label text-df-muted">VAT należny {money(sumInvoices(accepted, "totalVat"))}</p></Panel>
      <Panel><Link href="/invoices/attention" className="block"><p className="text-df-body text-df-muted">Wymagają uwagi</p><p className="my-1 text-[28px] font-bold">{attention.length}</p><p className="text-df-label text-df-amber">Odrzucone: {rejected.length} · ponawiane: {attention.length - rejected.length}</p></Link></Panel>
      <Panel><button type="button" onClick={() => { setFilter("overdue"); setPage(1); }} className="w-full text-left"><p className="text-df-body text-df-muted">Po terminie</p><p className="my-1 text-[28px] font-bold">{money(sumInvoices(overdue))}</p><p className="text-df-label text-df-amber">{overdue.length} po terminie · nieopłacone: {money(sumInvoices(unpaid))}</p></button></Panel>
    </div>
    {rejected.length > 0 && <Link href="/invoices/attention" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-df-error-surface px-4 py-3 text-df-body"><span>KSeF odrzucił faktury: {rejected.map(row => row.number).join(", ")}</span><strong className="text-df-error">Zobacz i napraw →</strong></Link>}
    <Panel>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input type="search" aria-label="Szukaj faktury po numerze, nabywcy lub NIP" placeholder="⌕   Szukaj numeru, nabywcy, NIP…" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="h-10 min-w-0 flex-1 rounded-[10px] bg-df-raised px-3.5 text-df-body placeholder:text-df-muted sm:min-w-[240px]" />
        <div role="group" aria-label="Filtry faktur" className="flex flex-wrap gap-2">{filters.map(({ key, label }) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }} className={cn("rounded-full border px-3 py-2 text-df-label font-semibold", filter === key ? "border-df-muted bg-df-line" : "border-transparent bg-df-raised hover:bg-df-hover")}>{label} {invoices.filter(row => matchesInvoiceFilter(row, key, now)).length}</button>)}</div>
        <span className="rounded-lg bg-df-amber-dark px-2.5 py-1 text-df-label font-semibold text-df-amber">KSeF · środowisko {envLabel(env)}</span>
      </div>
      {!results.length ? <NoResultsState query={query} description={invoices.length ? undefined : "Nie ma jeszcze faktur w tym środowisku KSeF."} onClearFilters={() => { setQuery(""); setFilter("all"); setPage(1); }} /> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] table-fixed text-left text-df-body"><caption className="sr-only">Faktury klientów · KSeF {envLabel(env)}</caption><colgroup>{[14, 21, 11, 10, 12, 18, 14].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead className="text-[11px] text-df-muted"><tr>{["NUMER", "NABYWCA", "ZLECENIE", "DATA", "BRUTTO", "STATUS KSEF", "NR KSEF"].map(label => <th key={label} scope="col" className="px-1 py-2.5 font-semibold">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-t border-df-line hover:bg-df-raised/40">
          <th scope="row" className="px-1 py-3.5 font-semibold"><Link href={invoiceHref(row.number, env)} className="hover:text-df-lime">{row.status === "draft" ? "Szkic" : row.number}</Link></th>
          <td className="px-1 py-3.5"><p className="font-semibold">{row.buyerName}</p><p className="mt-0.5 text-df-label text-df-muted">{row.buyerNip ? `NIP ${row.buyerNip}` : "osoba prywatna"}</p></td>
          <td className="px-1 py-3.5"><Link href={`/orders/${encodeURIComponent(row.orderNumber)}`} className="hover:text-df-lime">#{row.orderNumber}</Link></td>
          <td className="px-1 py-3.5">{row.status === "draft" ? "szkic" : date(row.issuedAt)}</td>
          <td className="px-1 py-3.5"><p className="whitespace-nowrap">{money(row.totalGross)}</p>{isUnpaid(row) && <Badge variant="overdue" className="mt-1 h-auto px-1.5 py-0.5 text-[10px]">{isOverdue(row, now) ? "Po terminie" : "Nieopłacona"}</Badge>}</td>
          <td className="px-1 py-3.5"><InvoiceStatus invoice={row} /></td>
          <td className="px-1 py-3.5">{row.ksefNumber ? <div className="flex items-center gap-2"><span title={row.ksefNumber} className="line-clamp-2 min-w-0 break-all text-[11px]">{row.ksefNumber}</span><button type="button" aria-label={`Kopiuj numer KSeF ${row.number}`} onClick={() => void copy(row.ksefNumber!)} className="flex size-8 shrink-0 items-center justify-center rounded-md bg-df-raised text-base text-df-muted">⧉</button></div> : "—"}</td>
        </tr>)}</tbody></table></div>
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-3 text-df-label text-df-muted"><p aria-live="polite">{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, results.length)} z {results.length} faktur</p><nav aria-label="Strony faktur" className="flex items-center gap-2"><button type="button" aria-label="Poprzednia strona" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="size-8 rounded hover:bg-df-raised disabled:opacity-40">‹</button><span>Strona {currentPage} z {pages}</span><button type="button" aria-label="Następna strona" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="size-8 rounded hover:bg-df-raised disabled:opacity-40">›</button></nav></footer>
      </>}
    </Panel>
    <p role="status" className="text-df-label text-df-muted">{message}</p>
  </div>;
}
