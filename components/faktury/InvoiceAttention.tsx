"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NoResultsState } from "@/components/states/no-results-state";
import { Sheet } from "@/components/studio/Sheet";
import { cn } from "@/lib/utils";
import { date, envLabel, invoiceHref, money, type Environment } from "./model";
import { isOverdue, matchesInvoiceSearch, requiresKsefAttention, type InvoiceRow } from "./list-model";
import { control, EnvironmentBanner, Panel } from "./shared";
import { InvoiceStatus } from "./InvoiceStatus";

export function InvoiceAttention({ invoices, env, now }: { invoices: InvoiceRow[]; env: Environment; now: string }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<{ row: InvoiceRow; kind: "nip" | "retry" } | null>(null);
  const [nip, setNip] = useState("");
  const attention = invoices.filter(requiresKsefAttention);
  const retrying = attention.filter(row => row.ksefStatus === "retrying");
  const overdue = invoices.filter(row => isOverdue(row, now));
  const visible = attention.filter(row => matchesInvoiceSearch(row, query));
  const visibleOverdue = overdue.filter(row => matchesInvoiceSearch(row, query));
  function open(row: InvoiceRow, kind: "nip" | "retry") { setAction({ row, kind }); setNip(row.buyerNip ?? ""); }
  return <div className="space-y-6">
    <EnvironmentBanner env={env} />
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-[34px] font-bold leading-tight">Wymagają uwagi</h1><p className="mt-2 text-df-body text-df-muted">{attention.length} faktur nie dotarło do KSeF. Wyjaśniamy, co się stało i co zrobić.</p></div><div className="flex max-w-full flex-wrap items-center gap-3"><input type="search" aria-label="Szukaj faktury wymagającej uwagi" placeholder="⌕   Szukaj numeru, nabywcy, NIP…" value={query} onChange={event => setQuery(event.target.value)} className={`${control} w-full bg-df-raised sm:w-[260px]`} /><Button variant="secondary" className="h-10 text-df-label" disabled={!retrying.length} onClick={() => setMessage(`Demo: przygotowano ponowienie ${retrying.length} wysyłek. Nie wysłano dokumentów do MF ani nie zmieniono kolejki.`)}>Ponów wysyłkę ({retrying.length})</Button></div></header>
    {message && <p role="status" className="text-df-label text-df-amber">{message}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        {visible.map(row => {
          const rejected = row.ksefStatus === "rejected";
          const latest = row.events[0];
          const nipError = rejected && row.events.some(event => event.kind === "rejected" && /NIP/i.test(event.message));
          const attempt = latest?.attempt ?? 0;
          return <article key={row.id} aria-label={`${row.number} · ${row.buyerName}`} className={cn("space-y-3.5 rounded-2xl border bg-df-panel p-5", rejected ? "border-df-error/40" : "border-df-retry/40")}>
            <header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-df-section"><Link href={invoiceHref(row.number, env)} className="hover:text-df-lime">{row.number} · {row.buyerName}</Link></h2><p className="mt-1 text-df-body text-df-muted">{money(row.totalGross)} · wystawiona {date(row.issuedAt, true)}</p></div><InvoiceStatus invoice={row} /></header>
            {rejected ? <>
              <div className="rounded-xl bg-df-error-surface px-4 py-3"><h3 className="font-semibold">{nipError ? "Nieprawidłowy NIP nabywcy" : "Dokument odrzucony przez KSeF"}</h3><p className="mt-1 text-df-body text-df-muted">{nipError ? `NIP „${row.buyerNip ?? "—"}”. Sprawdź dane nabywcy przed kolejną próbą.` : row.events.find(event => event.kind === "rejected")?.message} Ten dokument nie otrzymał numeru KSeF ({envLabel(env)}).</p></div>
              <div className="text-df-body"><h3 className="mb-2 font-semibold text-df-muted">Jak naprawić</h3><ol className="list-inside list-decimal space-y-2"><li>Sprawdź {nipError ? "NIP w Białej liście VAT" : "dane nabywcy i komunikat odrzucenia"}.</li><li>Popraw dane w niewysłanym dokumencie i sprawdź podgląd.</li><li>Zatwierdź ponowną wysyłkę do środowiska {envLabel(env)}.</li></ol></div>
              <div className="flex flex-wrap gap-2.5"><Button className="h-10 px-4 text-df-label" onClick={() => open(row, "nip")}>{nipError ? "Popraw NIP i wyślij ponownie" : "Sprawdź dane i ponów"}</Button>{row.phone ? <a href={`tel:${row.phone.replace(/[^+\d]/g, "")}`} className={buttonVariants({ variant: "secondary", className: "h-10 px-4 text-df-label" })}>Zadzwoń do klienta</a> : <Button variant="secondary" disabled className="h-10 text-df-label">Brak telefonu klienta</Button>}</div>
              <details open className="text-df-label text-df-muted"><summary className="mb-2 cursor-pointer text-right font-semibold">Szczegóły techniczne</summary><div className="space-y-1 break-words rounded-[10px] bg-df-bg px-3.5 py-3"><p>{latest?.message ?? "Brak komunikatu błędu w historii."}</p><p>ref: {latest?.ref ?? "—"} · próba {latest?.attempt ?? "—"} · nie ponawiamy automatycznie (błąd danych)</p><p>KSeF {envLabel(env)} · {date(latest?.at ?? null, true)}</p></div></details>
            </> : <>
              <p className="text-df-body text-df-muted">Brak odpowiedzi KSeF ({envLabel(env)}). Przed ponowieniem sprawdzamy status poprzedniej wysyłki.</p>
              <p className="text-df-label text-df-retry">{latest?.message ?? "Oczekiwanie na ponowienie."} · zdarzenie z {date(latest?.at ?? null, true)}</p>
              <div aria-label={`Próba ${attempt} z 8`} className="flex gap-1.5">{Array.from({ length: 8 }, (_, i) => <span key={i} className={cn("h-1.5 flex-1 rounded", i < attempt ? "bg-df-retry" : "bg-df-line")} />)}</div>
              <div className="flex flex-wrap gap-2.5"><Button variant="secondary" className="h-10 text-df-label" onClick={() => open(row, "retry")}>Ponów teraz</Button><Button variant="secondary" className="h-10 text-df-label" disabled>Offline · poza zakresem v1</Button></div><p className="text-df-label text-df-muted">Tryb offline jest poza zakresem v1.</p>
            </>}
          </article>;
        })}
        {visibleOverdue.length > 0 && <Panel><h2 className="mb-4 text-df-section text-df-amber">Zaległe płatności</h2><ul className="space-y-4">{visibleOverdue.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-df-line pb-4 last:border-0 last:pb-0"><div><Link href={invoiceHref(row.number, env)} className="font-semibold hover:text-df-lime">{row.number} · {row.buyerName}</Link><p className="mt-1 text-df-body text-df-muted">{money(row.totalGross)} · termin {date(row.dueAt)}</p></div><Badge variant="overdue">Nieopłacona · po terminie</Badge></li>)}</ul></Panel>}
        {!visible.length && !visibleOverdue.length && <NoResultsState query={query} description={query ? undefined : "W tym środowisku nie ma błędów KSeF ani zaległych płatności."} onClearFilters={() => setQuery("")} actions={<Link href="/invoices" className={buttonVariants()}>Wróć do faktur</Link>} />}
      </div>
      <aside className="space-y-5"><Panel><h2 className="mb-3 text-df-section">Połączenie z KSeF</h2><p className="mb-3 text-df-label text-df-muted">Podgląd danych · brak monitoringu połączenia z MF.</p><dl className="space-y-3 text-df-body">{[["Środowisko", envLabel(env)], ["Odrzucone", attention.filter(row => row.ksefStatus === "rejected").length], ["Ponawiane", retrying.length], ["Po terminie", overdue.length]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-df-muted">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl></Panel>
        <Panel><h2 className="mb-3 font-semibold">Legenda statusów</h2><dl className="space-y-3 text-df-label">{([
          ["draft", "Szkic", "jeszcze niewystawiona"], ["processing", "Przetwarzanie", "czeka na numer KSeF"],
          ["accepted-test", env === "test" ? "Przyjęta (test)" : "Przyjęta", "ma numer KSeF"], ["retry", "Ponawiamy", "chwilowy błąd, auto-retry"],
          ["rejected", "Odrzucona", "wymaga Twojej akcji"], ["overdue", "Nieopłacona", "zaległa płatność"],
        ] as const).map(([variant, label, description]) => <div key={variant} className="flex flex-wrap items-center justify-between gap-2"><dt><Badge variant={variant}>{label}</Badge></dt><dd className="text-df-muted">{description}</dd></div>)}</dl></Panel>
      </aside>
    </div>
    <Link href="/invoices" className="inline-block text-df-label text-df-muted hover:text-df-text">← Wszystkie faktury</Link>
    <Sheet open={!!action} onClose={() => setAction(null)} title={action?.kind === "nip" ? "Popraw dane nabywcy" : "Ponów wysyłkę"}>
      <p>{action?.row.number} · KSeF {envLabel(env)}</p><p className="text-df-muted">Demonstracja UI. Potwierdzenie nie zapisuje danych ani nie wysyła dokumentu do MF.</p>
      {action?.kind === "nip" && <label className="space-y-2">NIP nabywcy<input aria-label="NIP nabywcy" value={nip} onChange={event => setNip(event.target.value)} className={control} /><span className="block text-df-label text-df-muted">Sprawdź dane przed wysyłką. Walidacja MF nie jest uruchamiana w tym podglądzie.</span></label>}
      <div className="flex gap-3"><Button variant="secondary" onClick={() => setAction(null)}>Anuluj</Button><Button disabled={action?.kind === "nip" && !/^\d{10}$/.test(nip.replace(/[ -]/g, ""))} onClick={() => { setMessage(`Demo: potwierdzono ${action?.kind === "nip" ? "poprawę NIP i ponowienie" : "ponowienie"} ${action?.row.number}. Nie zapisano zmian ani nie wysłano dokumentu do MF.`); setAction(null); }}>Potwierdź (demo)</Button></div>
    </Sheet>
  </div>;
}
