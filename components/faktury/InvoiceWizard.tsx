"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Decimal from "decimal.js";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { control, EnvironmentBanner, Field, InvoicePreview, Panel } from "./shared";
import { date, invoiceHref, money, totals, validBuyer, validItems, type Buyer, type InvoiceView, type Item, type Order, type Seller } from "./model";

const schema = z.object({ orderId: z.string(), step: z.union([z.literal(1), z.literal(2), z.literal(3)]), company: z.boolean(), buyer: z.object({ name: z.string().max(200), nip: z.string().max(20), street: z.string().max(200), postal: z.string().max(10), city: z.string().max(100), email: z.string().max(200) }), items: z.array(z.object({ name: z.string().min(1).max(200), quantity: z.string(), unitNet: z.string(), vatRate: z.union([z.literal(23), z.literal(8), z.literal(5), z.literal(0)]), discount: z.string() })).max(100) });
type Draft = z.infer<typeof schema>;
export const invoiceDraftKey = (studioId: string, userId: string, env: Seller["env"]) => `df:invoice:v1:${studioId}:${userId}:${env}`;

export function InvoiceWizard({ studioId, userId, seller, orders }: { studioId: string; userId: string; seller: Seller; orders: Order[] }) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const first = orders.find(order => order.number === "DF-0243") ?? orders[0];
  const [draft, setDraft] = useState<Draft | null>(first ? { orderId: first.id, step: 1, company: !!first.buyer.nip, buyer: first.buyer, items: first.items as Draft["items"] } : null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [complete, setComplete] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const key = invoiceDraftKey(studioId, userId, seller.env);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = schema.safeParse(JSON.parse(raw));
        if (parsed.success && orders.some(order => order.id === parsed.data.orderId) && validItems(parsed.data.items)) {
          const data = parsed.data;
          if (!validBuyer(data.buyer, data.company)) data.step = 1;
          setDraft(data);
        } else setRestoreError("Szkic jest nieaktualny. Wczytano dane zlecenia.");
      }
    } catch { setRestoreError("Nie udało się odczytać szkicu. Wczytano dane zlecenia."); }
    setReady(true);
  }, [key, orders]);
  useEffect(() => {
    if (!ready || !draft) return;
    try { localStorage.setItem(key, JSON.stringify(draft)); setSaved("✓ Zapisano lokalnie"); }
    catch { setSaved("Nie zapisano szkicu — pamięć przeglądarki niedostępna."); }
  }, [draft, key, ready]);
  if (!draft || !first) return <Panel><h1 className="text-df-headline">Wystaw fakturę</h1><p className="mt-4 text-df-muted">Brak zakończonych zleceń. Fakturę można przygotować po zakończeniu zlecenia.</p><Link href="/orders" className="text-df-lime">Przejdź do zleceń →</Link></Panel>;
  const order = orders.find(order => order.id === draft.orderId)!;
  const buyerValid = validBuyer(draft.buyer, draft.company);
  const itemsValid = validItems(draft.items);
  // API stores the net unit price in cents; preview uses the same discounted prices.
  const invoiceItems = itemsValid ? draft.items.map(line => ({ ...line, unitNet: new Decimal(line.unitNet).times(new Decimal(100).minus(line.discount)).div(100).toFixed(2, Decimal.ROUND_HALF_UP), discount: "0" })) : [];
  const price = totals(invoiceItems);
  async function submit() {
    if (submitting.current || complete || !confirmed || !buyerValid || !itemsValid || !draft) return;
    submitting.current = true; setPending(true); setSubmitError("");
    try {
      const { name, nip, street, postal, city } = draft.buyer;
      const buyer = { name, nip, street, postal, city };
      const response = await fetch(`/api/studios/${studioId}/invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workOrderId: draft.orderId, buyer: { ...buyer, nip: draft.company ? buyer.nip : "" }, items: invoiceItems.map(({ name, quantity, unitNet, vatRate }) => ({ name, quantity, unitNet, vatRate })), dueDays: 7 }),
      });
      const data = await response.json();
      if (!response.ok) { setSubmitError(response.status < 500 && typeof data.error === "string" ? data.error : "Nie udało się wystawić faktury. Spróbuj ponownie."); return; }
      if (typeof data.number !== "string" || !["test", "production"].includes(data.ksefEnv)) throw new Error("Invalid invoice response");
      setComplete(true);
      try { localStorage.removeItem(key); } catch { /* Issuing succeeded even when storage is unavailable. */ }
      router.push(invoiceHref(data.number, data.ksefEnv)); router.refresh();
    } catch { setSubmitError("Nie udało się potwierdzić zapisu. Sprawdź listę faktur przed ponowną próbą."); }
    finally { submitting.current = false; setPending(false); }
  }
  function update(patch: Partial<Draft>) { setDraft(current => current ? { ...current, ...patch } : current); setConfirmed(false); setComplete(false); }
  function go(step: Draft["step"]) {
    if ((step > 1 && !buyerValid) || (step === 3 && !itemsValid)) return;
    update({ step }); title.current?.focus();
  }
  function buyer(patch: Partial<Buyer>) { update({ buyer: { ...draft!.buyer, ...patch } }); }
  function item(index: number, patch: Partial<Item>) { update({ items: draft!.items.map((line, i) => i === index ? { ...line, ...patch } as Draft["items"][number] : line) }); }
  const preview: InvoiceView = { id: "preview", number: "Numer nadany przy wystawieniu", env: seller.env, status: "draft", ksefStatus: "not_sent", ksefNumber: null, acceptedAt: null, issuedAt: new Date().toISOString(), saleAt: order.completedAt, dueAt: new Date(Date.now() + 7 * 86400000).toISOString(), paidAt: null, emailedAt: null, upoXml: null, kind: "invoice", correctsNumber: null, correctionReason: null, corrections: [], current: [], orderNumber: order.number, buyer: { ...draft.buyer, nip: draft.company ? draft.buyer.nip : "" }, items: invoiceItems, totalNet: price.net.toString(), totalVat: price.vat.toString(), totalGross: price.gross.toString(), events: [] };
  if (!ready) return <p role="status">Odczytywanie szkicu faktury…</p>;
  return <div className="space-y-6">
    <EnvironmentBanner env={seller.env} />
    {restoreError && <p role="alert" className="text-df-amber">{restoreError}</p>}
    <header className="flex flex-wrap justify-between gap-3"><div><h1 ref={title} tabIndex={-1} className="text-df-headline">Wystaw fakturę</h1><p className="mt-1 text-df-muted">Zakończone zlecenie #{order.number} · {order.vehicle} · {date(order.completedAt)}</p></div><p role="status" className="text-df-label text-df-muted">{saved}</p></header>
    <nav aria-label="Kroki faktury"><ol className="flex flex-wrap gap-4">{["Nabywca", "Pozycje i VAT", "Podgląd i wysyłka"].map((label, i) => <li key={label}><button type="button" aria-current={draft.step === i + 1 ? "step" : undefined} disabled={pending || complete || (i > 0 && !buyerValid) || (i === 2 && !itemsValid)} onClick={() => go((i + 1) as Draft["step"])} className="flex items-center gap-2 disabled:opacity-40"><span className={`flex size-6 items-center justify-center rounded-full border ${i < draft.step ? "border-df-lime bg-df-lime text-df-bg" : "border-df-muted text-df-muted"}`}>{i + 1 < draft.step ? "✓" : i + 1}</span>{label}{i < 2 && <span aria-hidden="true" className="ml-2 hidden h-px w-12 bg-df-line sm:block" />}</button></li>)}</ol></nav>
    {submitError && <p role="alert" className="text-df-amber">{submitError}</p>}
    {complete ? <Panel><p role="status">Wystawiono fakturę. Otwieranie dokumentu…</p></Panel> : <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        {draft.step === 1 && <Panel><h2 className="mb-4 text-df-section">Zlecenie źródłowe</h2><Field label="Zakończone zlecenie"><select value={draft.orderId} className={control} onChange={event => { const next = orders.find(order => order.id === event.target.value)!; update({ orderId: next.id, buyer: next.buyer, company: !!next.buyer.nip, items: next.items as Draft["items"] }); }}>{orders.map(order => <option key={order.id} value={order.id}>#{order.number} · {order.buyer.name} · {order.vehicle}</option>)}</select></Field></Panel>}
        {draft.step !== 3 && <Panel><div className="mb-4 flex justify-between"><h2 className="text-df-section">Nabywca</h2>{draft.step === 2 && <button className="text-df-lime" onClick={() => go(1)}>Zmień</button>}</div>
          <fieldset className="mb-4 flex max-w-[360px] gap-2 rounded-xl bg-df-bg p-1"><legend className="sr-only">Rodzaj nabywcy</legend>{[false, true].map(company => <label key={String(company)} className={`flex-1 cursor-pointer rounded-lg p-2 text-center ${draft.company === company ? "bg-df-raised" : "text-df-muted"}`}><input type="radio" name="buyer-type" checked={draft.company === company} onChange={() => update({ company })} className="mr-2 accent-df-lime" />{company ? "Firma (NIP)" : "Osoba prywatna"}</label>)}</fieldset>
          {draft.step === 1 ? <div className="grid gap-4 sm:grid-cols-2">{([ ["name", draft.company ? "Nazwa firmy" : "Imię i nazwisko"], ...(draft.company ? [["nip", "NIP"]] : []), ["street", "Adres"], ["postal", "Kod pocztowy"], ["city", "Miasto"], ["email", "E-mail do wysyłki PDF"] ] as [keyof Buyer, string][]).map(([key, label]) => <Field key={key} label={label}><input className={control} value={draft.buyer[key]} type={key === "email" ? "email" : "text"} maxLength={200} onChange={event => buyer({ [key]: event.target.value })} /></Field>)}{!buyerValid && <p className="text-df-amber sm:col-span-2">Uzupełnij nazwę, adres, kod pocztowy, e-mail{draft.company ? " i poprawny NIP" : ""}.</p>}</div> : <div className="grid gap-4 sm:grid-cols-3"><p>{draft.buyer.name}{draft.company && <span className="block">NIP {draft.buyer.nip}</span>}</p><p>{draft.buyer.street}, {draft.buyer.postal} {draft.buyer.city}</p><p className="break-all">{draft.buyer.email}</p></div>}
          <p className="mt-4 rounded-lg bg-df-blue-dark p-3 text-df-label text-df-blue">Wystawienie zapisuje fakturę. Wysyłka PDF i wysyłka do KSeF są osobnymi czynnościami.</p>
        </Panel>}
        {draft.step === 2 && <Panel><h2 className="mb-5 text-df-section">Pozycje ze zlecenia</h2><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="text-df-label text-df-muted"><tr>{["USŁUGA", "ILOŚĆ", "CENA NETTO", "RABAT %", "VAT", "WARTOŚĆ NETTO"].map(label => <th key={label} className="pb-4 pr-2 font-normal">{label}</th>)}</tr></thead><tbody>{draft.items.map((line, i) => <tr key={i} className="border-t border-df-line"><td className="w-[30%] py-5 pr-3">{line.name}</td>{([ ["quantity", "Ilość"], ["unitNet", "Cena netto"], ["discount", "Rabat"] ] as const).map(([key, label]) => <td key={key} className="px-1"><input aria-label={`${label}: ${line.name}`} inputMode="decimal" className={`${control} max-w-[100px] px-2`} value={line[key]} onChange={event => item(i, { [key]: event.target.value.replace(",", ".") })} /></td>)}<td className="px-1"><select className={`${control} w-16 px-1`} aria-label={`VAT: ${line.name}`} value={line.vatRate} onChange={event => item(i, { vatRate: Number(event.target.value) })}>{[23, 8, 5, 0].map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></td><td className="pl-2 whitespace-nowrap">{itemsValid ? money(price.lines[i]!.net) : "—"}</td></tr>)}</tbody></table></div>{!itemsValid && <p role="alert" className="text-df-amber">Sprawdź ilość (większa od 0), cenę netto i rabat od 0 do 100%.</p>}</Panel>}
        {draft.step === 3 && <><div className="overflow-x-auto rounded-2xl bg-df-panel p-5"><InvoicePreview invoice={preview} seller={seller} /></div><Panel><p className="mb-4 text-df-muted">Potwierdzenie wystawia fakturę. Nie wysyła jej do KSeF ani e-mailem. Rabat jest wliczany w cenę netto zaokrągloną do grosza.</p><label className="flex gap-3"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="accent-df-lime" />Sprawdziłem nabywcę, pozycje i kwoty VAT.</label></Panel></>}
        <footer className="flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-df-panel p-5"><p className="flex-1 text-df-label text-df-muted">Krok {draft.step} z 3 · szkic zapisuje się automatycznie</p><Button variant="secondary" disabled={draft.step === 1} onClick={() => go((draft.step - 1) as Draft["step"])}>← Wstecz</Button><Button disabled={pending || (draft.step === 1 ? !buyerValid : draft.step === 2 ? !itemsValid : !confirmed || !buyerValid || !itemsValid)} onClick={() => draft.step === 3 ? void submit() : go((draft.step + 1) as Draft["step"])}>{draft.step === 1 ? "Dalej: pozycje →" : draft.step === 2 ? "Dalej: podgląd →" : pending ? "Wystawianie…" : "Wystaw fakturę"}</Button></footer>
      </fieldset>
      <aside className="space-y-5"><Panel><h2 className="mb-4 text-df-section">Podsumowanie</h2><dl className="space-y-3">{[["Netto", money(price.net)], ["VAT", money(price.vat)], ["Brutto", money(price.gross)], ["Płatność", "Przelew · 7 dni"], ["Data wystawienia", date(preview.issuedAt)], ["Data sprzedaży", date(preview.saleAt)], ["Numer", "nadany przy wystawieniu"]].map(([label, value]) => <div key={label} className={`flex justify-between gap-4 ${label === "Brutto" ? "border-t border-df-line pt-3 text-df-section" : "text-df-muted"}`}><dt>{label}</dt><dd className="text-right text-df-text">{value}</dd></div>)}</dl></Panel><Panel className="bg-df-amber-dark text-df-amber"><h2 className="font-semibold">Po wystawieniu nie można edytować</h2><p className="mt-2 text-df-label">Zmiany wystawionej faktury będą możliwe tylko przez fakturę korygującą.</p></Panel><Panel><h2 className="mb-3 font-semibold">Kontrola przed wysyłką</h2><p className="text-df-lime">{buyerValid ? "✓" : "○"} Dane nabywcy kompletne</p><p className="mt-2 text-df-lime">{itemsValid ? "✓" : "○"} Sumy VAT się zgadzają</p><p className="mt-2 text-df-muted">Walidacja XSD FA(3) — przy integracji KSeF</p></Panel></aside>
    </div>}
  </div>;
}
