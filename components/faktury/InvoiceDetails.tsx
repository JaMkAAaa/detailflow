"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/studio/Sheet";
import { useMobile } from "@/components/studio/useMobile";
import { MobileInvoiceDetails } from "./MobileInvoiceDetails";
import { date, envLabel, invoiceHref, money, type InvoiceView, type Seller } from "./model";
import { control, EnvironmentBanner, InvoicePreview, Panel } from "./shared";

export function InvoiceDetails({ invoice: loaded, seller, studioId }: { invoice: InvoiceView; seller: Seller; studioId: string }) {
  const mobile = useMobile();
  const router = useRouter();
  const [paidAt, setPaidAt] = useState<string | null>(null);
  // Data płatności widać od razu po zapisie, jeszcze przed odświeżeniem danych strony.
  const [queued, setQueued] = useState(false);
  const invoice = paidAt && !loaded.paidAt ? { ...loaded, paidAt } : loaded;
  const isCorrection = invoice.kind === "correction";
  const [more, setMore] = useState(false);
  const [action, setAction] = useState<"paid" | "resend" | "correction" | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<Record<number, { quantity: string; unitNet: string }>>({});
  const [extraEvents, setExtraEvents] = useState<InvoiceView["events"]>([]);
  const ksefStatus = queued && loaded.ksefStatus === "not_sent" ? "queued" : invoice.ksefStatus;
  const events = [...extraEvents.filter(event => event.id !== "ksef-queued" || loaded.ksefStatus === "not_sent"), ...invoice.events];
  const accepted = ksefStatus === "accepted";
  const label = accepted ? (invoice.env === "test" ? "Przyjęta (test)" : "Przyjęta") : ({ rejected: "Odrzucona", retrying: "Ponawiamy", processing: "Przetwarzanie", not_sent: "Nie wysłano", queued: "W kolejce" }[ksefStatus] ?? ksefStatus);
  const acceptanceSeconds = invoice.acceptedAt && invoice.issuedAt ? (new Date(invoice.acceptedAt).getTime() - new Date(invoice.issuedAt).getTime()) / 1000 : null;
  async function download(format: "pdf" | "xml") {
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/invoices/${encodeURIComponent(invoice.id)}/${format}?env=${invoice.env}`);
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Nie udało się pobrać dokumentu.");
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `${invoice.number.replaceAll("/", "-")}-${envLabel(invoice.env)}.${format}`;
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(`Pobrano ${format.toUpperCase()}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Nie udało się pobrać dokumentu."); }
  }
  function downloadUpo() {
    if (!invoice.upoXml) { setMessage("UPO XML nie jest dostępne w danych demonstracyjnych. Nie pobrano dokumentu z MF."); return; }
    const url = URL.createObjectURL(new Blob([invoice.upoXml], { type: "application/xml;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${invoice.number.replaceAll("/", "-")}-${envLabel(invoice.env)}-UPO.xml`; anchor.click(); URL.revokeObjectURL(url);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(invoice.ksefNumber!); setMessage("Skopiowano pełny numer KSeF."); }
    catch { setMessage("Nie udało się skopiować. Zaznacz numer KSeF i skopiuj go ręcznie."); }
  }
  const line = (item: InvoiceView["current"][number]) => lines[item.lp] ?? { quantity: item.quantity, unitNet: item.unitNet };
  const changedLines = invoice.current.filter(item => { const next = line(item); return next.quantity !== item.quantity || next.unitNet !== item.unitNet; });
  function closeAction() { setAction(null); setReason(""); setLines({}); setError(""); }
  async function post(path: string, body: unknown) {
    const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/invoices/${encodeURIComponent(invoice.id)}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Nie udało się zapisać zmiany.");
    return data;
  }
  async function sendKsef() {
    setBusy(true); setMessage("");
    try {
      await post("ksef", {});
      setQueued(true);
      setExtraEvents(current => [{ id: "ksef-queued", kind: "validated", at: new Date().toISOString(), message: `Skierowano do KSeF ${envLabel(invoice.env)}`, ref: null }, ...current]);
      setMessage("Faktura jest w kolejce KSeF.");
      router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Nie udało się skierować faktury do KSeF."); }
    finally { setBusy(false); }
  }
  async function confirm() {
    if (action === "resend") {
      setExtraEvents(current => [{ id: `demo-${current.length}`, kind: "demo", at: new Date().toISOString(), message: "Potwierdzono ponowną wysyłkę (demo)", ref: null }, ...current]);
      setMessage("Potwierdzono ponowną wysyłkę (demo). Zmiana dotyczy tylko tego podglądu. Nie zapisano danych, nie wysłano wiadomości ani dokumentów do MF.");
      closeAction(); return;
    }
    setBusy(true); setError("");
    try {
      if (action === "paid") {
        const result = await post("paid", {});
        setPaidAt(result.paidAt); setMessage(`Oznaczono ${invoice.number} jako opłaconą.`);
      } else {
        const result = await post("corrections", { reason, items: changedLines.map(item => ({ lp: item.lp, ...line(item) })) });
        setMessage(`Wystawiono korektę ${result.number} do ${invoice.number}. Wysyłka do KSeF jest osobnym krokiem.`);
        router.push(invoiceHref(result.number, invoice.env));
      }
      closeAction(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się zapisać zmiany."); }
    finally { setBusy(false); }
  }
  const feedback = <p role="status" className="text-df-label text-df-amber print:hidden">{message || "PDF i XML są dostępne do pobrania. Płatność i korekta zapisują się w systemie; ponowna wysyłka PDF działa w trybie demonstracyjnym."}</p>;
  return <div className="df-invoice-screen space-y-6">
    {invoice.status === "issued" && ksefStatus === "not_sent" && <div className="flex flex-wrap items-center gap-3 print:hidden"><Button disabled={busy} onClick={() => void sendKsef()}>{busy ? "Wysyłanie…" : "Wyślij do KSeF"}</Button><Link href="/settings" className="text-df-label text-df-lime">Ustawienia i token KSeF</Link></div>}
    {mobile && <MobileInvoiceDetails invoice={{ ...invoice, ksefStatus }} label={label} seconds={acceptanceSeconds} copy={() => void copy()} upo={downloadUpo} xml={() => void download("xml")} pdf={() => void download("pdf")} paid={() => setAction("paid")} correction={() => setAction("correction")} resend={() => setAction("resend")} more={() => setMore(true)} />}
    <div hidden={mobile} className={mobile ? "hidden print:block" : "space-y-6"}>
    <div className="print:hidden"><EnvironmentBanner env={invoice.env} /></div>
    <header className="flex flex-wrap items-start justify-between gap-4 print:hidden"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-df-headline">{invoice.number}</h1><Badge variant={accepted ? "accepted-test" : invoice.ksefStatus === "rejected" ? "rejected" : "processing"}>{label}</Badge></div><p className="mt-2 text-df-muted">{invoice.buyer.name} · #{invoice.orderNumber} · wystawiona {date(invoice.issuedAt, true)}</p>{invoice.correctsNumber && <p className="mt-1 text-df-body">Korekta do <Link className="text-df-lime hover:underline" href={invoiceHref(invoice.correctsNumber, invoice.env)}>{invoice.correctsNumber}</Link>{invoice.correctionReason && ` · ${invoice.correctionReason}`}</p>}{invoice.corrections.length > 0 && <p className="mt-1 text-df-body">Korekty: {invoice.corrections.map((item, index) => <span key={item.number}>{index > 0 && ", "}<Link className="text-df-lime hover:underline" href={invoiceHref(item.number, invoice.env)}>{item.number}</Link></span>)}</p>}</div><div className="flex flex-wrap gap-3">{!isCorrection && <Button variant="secondary" onClick={() => setAction("correction")}>Wystaw korektę</Button>}<Button variant="secondary" onClick={() => setAction("resend")}>{invoice.emailedAt ? "Wyślij ponownie" : "Wyślij PDF"}</Button>{!isCorrection && <Button disabled={!!invoice.paidAt} onClick={() => setAction("paid")}>Oznacz jako opłaconą</Button>}</div></header>

    {!mobile && feedback}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px] print:block">
      <div className="df-invoice-wrapper overflow-x-auto rounded-2xl bg-df-panel p-7 print:overflow-visible print:bg-white print:p-0"><InvoicePreview invoice={invoice} seller={seller} /></div>
      <aside className="space-y-5 print:hidden"><Panel><div className="mb-4 flex justify-between"><h2 className="text-df-section">Status w KSeF</h2><strong className="text-df-label text-df-amber">{envLabel(invoice.env)}</strong></div>
        <div className="mb-4 rounded-xl bg-df-lime-dark p-3"><p className="text-df-label text-df-muted">Numer KSeF</p><div className="mt-1 flex items-center gap-2"><p className="min-w-0 flex-1 break-all text-df-label text-df-lime" title={invoice.ksefNumber ?? undefined}>{invoice.ksefNumber ?? "Oczekiwanie na numer"}</p><button type="button" disabled={!invoice.ksefNumber} onClick={copy} aria-label="Kopiuj numer KSeF" className="min-h-10 min-w-10 text-xl text-df-lime disabled:opacity-40">⧉</button></div></div>
        <dl className="space-y-3">{[[label, date(invoice.acceptedAt, true)], ["Czas do przyjęcia", acceptanceSeconds === null ? "—" : `${acceptanceSeconds} s`], ["Schemat", "FA(3)"]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-df-muted">{label}</dt><dd className="text-right">{value}</dd></div>)}</dl>
        <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" className="h-9 flex-1 px-3 text-df-label" onClick={downloadUpo}>↓ UPO (XML)</Button><Button variant="secondary" className="h-9 flex-1 px-3 text-df-label" onClick={() => void download("xml")}>↓ Faktura (XML)</Button></div>
      </Panel>
      <Panel><h2 className="mb-4 text-df-section">Historia wysyłki</h2><ol aria-label="Historia zdarzeń" className="space-y-0">{events.map(event => {
        const asset = event.kind === "accepted" ? "accepted" : event.kind === "timeout" || event.kind === "rejected" ? "timeout" : event.kind === "validated" ? "validated" : event.kind === "issued" ? "issued" : "processing";
        return <li key={event.id} className="flex min-h-10 gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/faktury/history-${asset}.svg`} width={10} height={asset === "issued" ? 10 : 40} alt="" className="mt-1 shrink-0 self-start" />
          <div className="min-w-0 pb-2"><p className="text-df-body">{event.message}{event.ref && <span className="break-all text-df-label text-df-muted"> (ref. {event.ref})</span>}</p><time dateTime={event.at} className="text-[11px] text-df-muted">{date(event.at, true)}</time></div>
        </li>;
      })}</ol>{!events.length && <p className="text-df-muted">Brak zdarzeń wysyłki.</p>}</Panel>
      <Panel><div className="flex justify-between gap-3"><h2 className="text-df-section">Płatność</h2><Badge variant={invoice.paidAt ? "completed" : "overdue"}>{invoice.paidAt ? "Opłacona" : "Nieopłacona"}</Badge></div><p className="mt-3 break-words text-[11px] text-df-muted">Wysłano: {date(invoice.emailedAt, true)} · {invoice.buyer.email || "brak e-maila"}</p><dl className="my-4 flex justify-between gap-3"><dt className="text-df-muted">Termin</dt><dd>{date(invoice.dueAt)}</dd></dl><Button variant="secondary" className="w-full" onClick={() => void download("pdf")}>Pobierz PDF</Button></Panel></aside>
    </div>
    </div>
    {mobile && feedback}
    <Sheet open={more} onClose={() => setMore(false)} title="Akcje faktury"><Button variant="secondary" onClick={() => { setMore(false); void download("pdf"); }}>Pobierz PDF</Button><Button variant="secondary" onClick={() => { setMore(false); setAction("resend"); }}>{invoice.emailedAt ? "Wyślij ponownie" : "Wyślij PDF"}</Button>{!isCorrection && <Button variant="secondary" onClick={() => { setMore(false); setAction("correction"); }}>Wystaw korektę</Button>}<h2 className="text-df-section">Historia wysyłki</h2><ol className="space-y-3">{events.map(event => <li key={event.id}><p>{event.message}</p><time className="text-df-label text-df-muted">{date(event.at, true)}</time></li>)}</ol></Sheet>
    <Sheet open={action !== null} onClose={closeAction} title={action === "paid" ? "Oznacz jako opłaconą" : action === "correction" ? "Wystaw korektę" : "Wyślij ponownie"}><p>{invoice.number} · KSeF {envLabel(invoice.env)}</p>
      {action === "paid" && <p className="text-df-muted">Płatność ręczna (przelew) na kwotę {money(invoice.totalGross)}. Zapisujemy datę dzisiejszą; nie wysyłamy nic do klienta ani do MF.</p>}
      {action === "resend" && <><p className="text-df-muted">Tryb demonstracyjny. Potwierdzenie nie zapisuje zmian ani nie wysyła dokumentów lub e-maili.</p><p className="break-all">Odbiorca PDF: {invoice.buyer.email || "brak adresu e-mail"}</p></>}
      {action === "correction" && <><p>Korekta jest osobnym dokumentem powiązanym z {invoice.number}. Zmień ilość lub cenę netto pozycji; wartości zostają po korekcie.</p>
        {invoice.current.map(item => <fieldset key={item.lp} className="grid grid-cols-2 gap-2"><legend className="mb-1 text-df-label text-df-muted">{item.lp}. {item.name}</legend>
          <label className="space-y-1 text-df-label">Ilość<input inputMode="decimal" className={control} value={line(item).quantity} onChange={event => setLines(current => ({ ...current, [item.lp]: { ...line(item), quantity: event.target.value } }))} /></label>
          <label className="space-y-1 text-df-label">Cena netto (zł)<input inputMode="decimal" className={control} value={line(item).unitNet} onChange={event => setLines(current => ({ ...current, [item.lp]: { ...line(item), unitNet: event.target.value } }))} /></label></fieldset>)}
        <label className="space-y-2">Powód korekty<textarea className={`${control} h-24 py-2`} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></>}
      {error && <p role="alert" className="text-df-label text-df-error">{error}</p>}
      <div className="flex gap-3"><Button variant="secondary" onClick={closeAction}>Anuluj</Button><Button disabled={busy || (action === "correction" ? !reason.trim() || !changedLines.length : action === "resend" ? !invoice.buyer.email : false)} onClick={() => void confirm()}>{action === "resend" ? "Potwierdź (demo)" : action === "paid" ? "Potwierdź płatność" : "Potwierdź korektę"}</Button></div></Sheet>
  </div>;
}
