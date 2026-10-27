"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/studio/Sheet";
import { cn } from "@/lib/utils";
import type { QuoteWizardData } from "@/src/server/wyceny/query";
import { saveQuoteAction, sendQuoteAction, updateServiceAction } from "@/app/(studio)/quotes/new/actions";
import { sizes, paints, slots, initialDraft, draftKey, draftSchema, preview, pln, type Draft } from "./demo";

const control = "h-[43px] w-full min-w-0 rounded-lg bg-df-raised px-3 text-df-body text-df-text";
function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl bg-df-panel p-5", className)}>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2 text-df-label text-df-muted">{label}{children}</label>;
}

export function QuoteWizard({ studioId, userId, data }: { studioId: string; userId: string; data: QuoteWizardData }) {
  const clients = data.clients;
  const [services, setServices] = useState(() => data.services.map((service) => {
    const snapshot = data.quote?.items.find((item) => item.serviceId === service.id);
    return snapshot ? { ...service, name: snapshot.name, price: snapshot.basePrice, durationMin: snapshot.durationMin ?? service.durationMin, hours: new Decimal(snapshot.durationMin ?? service.durationMin).times("1.2").div(60).toString() } : service;
  }));
  const freshDraft: Draft = { ...initialDraft, clientId: clients[0]?.id ?? "", vehicleId: clients[0]?.vehicles[0]?.id ?? "", serviceIds: services.filter((service) => ["correction", "ceramic"].includes(service.code)).map((service) => service.id) };
  const [draft, setDraft] = useState<Draft>(data.quote?.draft ?? freshDraft);
  const identity = useRef({ id: data.quote?.id ?? "", revision: data.quote?.revision ?? 0 });
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deliveryState, setDeliveryState] = useState(data.quote?.status === "sent" && !data.quote.pending ? "sent" : "pending");
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(data.quote ? data.quote.pending ? "Wiadomość oczekuje na wysyłkę" : data.quote.status === "sent" ? "✓ Wysłano wycenę" : "✓ Zapisano szkic w studiu" : "Odczytywanie szkicu…");
  const [catalog, setCatalog] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(data.services[0]?.id ?? "");
  const editingService = services.find((service) => service.id === editingServiceId);
  const [confirmed, setConfirmed] = useState(false);
  const [complete, setComplete] = useState(!!data.quote && (data.quote.status === "sent" || data.quote.pending));
  const [restoreError, setRestoreError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const key = draftKey(studioId, userId);
  const price = preview(draft, services);
  const client = clients.find((client) => client.id === draft.clientId)!;
  const vehicle = client?.vehicles.find((vehicle) => vehicle.id === draft.vehicleId);
  const slot = slots.find((slot) => slot.id === draft.slotId);
  const validSlot = slot && price.hours.lte(slot.hours);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw && !data.quote) {
        const result = draftSchema.safeParse(JSON.parse(raw));
        if (result.success && clients.some((client) => client.id === result.data.clientId && client.vehicles.some((vehicle) => vehicle.id === result.data.vehicleId)) && result.data.serviceIds.every((id) => services.some((service) => service.id === id))) {
          const restored = result.data;
          if (restored.step === 3 && restored.serviceIds.length === 0) restored.step = 2;
          setDraft(restored);
        } else setRestoreError("Nie udało się odtworzyć szkicu. Wczytano bieżące dane studia.");
      }
    } catch {
      setRestoreError("Nie udało się odczytać szkicu z tej przeglądarki.");
    }
    identity.current.id ||= crypto.randomUUID();
    setReady(true);
  // Dane początkowe są odtwarzane raz dla aktywnego studia/użytkownika.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function persist(snapshot: Draft) {
    const items = services.filter((service) => snapshot.serviceIds.includes(service.id)).map((service) => ({ serviceId: service.id, name: service.name, basePrice: service.price, durationMin: service.durationMin }));
    const next = saving.current.catch(() => {}).then(async () => {
      const result = await saveQuoteAction(studioId, { ...snapshot, ...identity.current, items });
      if (!result.ok) throw new Error(result.error);
      identity.current = result.value;
      setSaved("✓ Zapisano szkic w studiu");
    });
    saving.current = next;
    return next;
  }

  useEffect(() => {
    if (!ready || busy || complete || !draft.clientId || !draft.vehicleId) return;
    try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Baza pozostaje źródłem prawdy. */ }
    setSaved("Zapisywanie szkicu…");
    const timer = setTimeout(() => {
      void persist(draft).catch((error: unknown) => {
        setSaved("Nie zapisano szkicu");
        setError(error instanceof Error ? error.message : "Nie udało się zapisać wyceny.");
      });
    }, 500);
    return () => clearTimeout(timer);
  // persist korzysta z aktualnych usług i serializuje zapisy przez saving.current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, key, ready, busy, complete, services]);

  async function submit(resend = false) {
    setBusy(true); setError("");
    try {
      if (!resend) await persist(draft);
      else await saving.current.catch(() => {});
      const result = await sendQuoteAction(studioId, identity.current.id);
      if (!result.ok) throw new Error(result.error);
      setDeliveryState("pending");
      setComplete(true);
      setSaved("Wiadomość oczekuje na wysyłkę");
      title.current?.focus();
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się wysłać wyceny."); }
    finally { setBusy(false); }
  }

  function newQuote() {
    identity.current = { id: crypto.randomUUID(), revision: 0 };
    setServices(data.services);
    setDraft(freshDraft); setComplete(false); setConfirmed(false); setError("");
  }

  function update(patch: Partial<Draft>) {
    setError("");
    setDraft((current) => ({ ...current, ...patch }));
    setConfirmed(false);
  }
  function go(step: Draft["step"]) {
    if (step === 3 && !price.selected.length) return;
    update({ step });
    requestAnimationFrame(() => title.current?.focus());
  }
  function toggleService(id: Draft["serviceIds"][number]) {
    update({ serviceIds: draft.serviceIds.includes(id) ? draft.serviceIds.filter((item) => item !== id) : [...draft.serviceIds, id] });
  }

  if (!ready) return <p role="status" className="text-df-muted">Odczytywanie szkicu wyceny…</p>;

  if (!client || !vehicle) return <p role="status">Dodaj klienta i samochód w zakładce Klienci, aby utworzyć wycenę.</p>;

  return <div className="flex flex-col gap-6">
    <header className="flex min-h-[70px] flex-wrap items-start justify-between gap-3">
      <div><h1 ref={title} tabIndex={-1} className="text-df-headline">Nowa wycena</h1>
        <p className="mt-1 text-df-muted">Od potrzeb klienta do konkretnej ceny. Bez liczenia w Excelu.</p></div>
      <p role="status" className="text-df-label text-df-muted">{saved}</p>
    </header>
    {error && <p role="alert" className="text-df-amber">{error}</p>}
    {restoreError && <p role="alert" className="text-df-amber">{restoreError}</p>}
    <nav hidden={complete} aria-label="Kroki wyceny"><ol className="flex flex-wrap items-center gap-3">
      {["Klient i auto", "Usługi i wycena", "Termin i potwierdzenie"].map((label, index) => {
        const step = (index + 1) as Draft["step"];
        return <li key={label} className="flex items-center gap-3">
          {index > 0 && <span aria-hidden="true" className={cn("hidden h-px w-12 sm:block", step <= draft.step ? "bg-df-lime" : "bg-df-line")} />}
          <button type="button" onClick={() => go(step)} disabled={step === 3 && !price.selected.length} aria-current={draft.step === step ? "step" : undefined} className={cn("flex items-center gap-2 py-1 disabled:cursor-not-allowed", step === draft.step ? "font-semibold" : "text-df-muted")}>
            <span aria-hidden="true" className={cn("flex size-6 items-center justify-center rounded-full border text-df-label", step <= draft.step ? "border-df-lime bg-df-lime text-df-bg" : "border-df-muted")}>{step < draft.step ? "✓" : step}</span>
            {label}
          </button>
        </li>;
      })}
    </ol></nav>

    {complete ? <Panel className="flex flex-col items-start gap-4" >
      <Badge variant="completed">{deliveryState === "sent" ? "Wysłano" : "W kolejce do wysyłki"}</Badge>
      <h2 className="text-df-section">{deliveryState === "sent" ? "Wycena wysłana" : "Wycena zapisana i przekazana do wysyłki"}</h2>
      <p>{client.name} · {vehicle.label} · {pln(price.gross)}</p>
      <p className="text-df-muted">{deliveryState === "sent" ? "Wiadomość została przyjęta przez serwer pocztowy." : "Wysyłkę obsłuży worker. Odśwież stronę, aby sprawdzić jej status."} Termin jest propozycją i nie rezerwuje boksu.</p>
      <Button variant="secondary" disabled={busy} onClick={() => void submit(true)}>Wyślij ponownie</Button>
      <Button onClick={newQuote} disabled={busy}>Nowa wycena</Button>
    </Panel> : <fieldset disabled={busy} className="contents">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2.016fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {draft.step !== 3 && <Panel className="flex flex-col gap-2.5">
            <div className="flex min-h-7 items-center justify-between gap-2"><h2 className="text-df-section">Klient i samochód</h2>
              {draft.step === 2 && <button type="button" onClick={() => go(1)} className="text-df-label text-df-muted">Zmień klienta ↗</button>}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Klient"><select className={control} value={draft.clientId} onChange={(event) => {
                const next = clients.find((client) => client.id === event.target.value)!;
                update({ clientId: next.id, vehicleId: next.vehicles[0]!.id });
              }}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
              <Field label="Samochód"><select className={control} value={draft.vehicleId} onChange={(event) => update({ vehicleId: event.target.value as Draft["vehicleId"] })}>{client.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>)}</select></Field>
            </div>
            <fieldset className="mt-1"><legend className="mb-2 text-df-label text-df-muted">Wielkość auta</legend>
              <div className="grid grid-cols-3 gap-3">{sizes.map((size) => <label key={size.id} className={cn("flex min-h-10 cursor-pointer items-center justify-center rounded-lg border px-1 text-center text-df-label", draft.size === size.id ? "border-df-muted bg-df-line" : "border-transparent bg-df-raised")}>
                <input className="sr-only peer" type="radio" name="size" value={size.id} checked={draft.size === size.id} onChange={() => update({ size: size.id })} />
                <span className="peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-df-lime">{draft.size === size.id && "✓ "}{size.label}</span>
              </label>)}</div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stan lakieru"><select className={control} value={draft.paint} onChange={(event) => update({ paint: event.target.value as Draft["paint"] })}>{paints.map((paint) => <option key={paint.id} value={paint.id}>{paint.label}</option>)}</select></Field>
              <Field label="Zabrudzenie wnętrza"><select className={control} value={draft.interior} onChange={(event) => update({ interior: event.target.value as Draft["interior"] })}>{["Lekkie", "Umiarkowane", "Silne"].map((label) => <option key={label}>{label}</option>)}</select></Field>
            </div>
          </Panel>}

          {draft.step === 2 && <>
            <Panel className="flex flex-col gap-3.5">
              <div className="flex min-h-7 items-center justify-between gap-2"><h2 className="text-df-section">Usługi</h2><button type="button" className="text-df-label text-df-muted" onClick={() => setCatalog(true)}>＋ Dodaj z katalogu</button></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[530px] text-left">
                <thead className="border-b border-df-line text-df-label text-df-muted"><tr>{["USŁUGA", "CENA BAZOWA", "CZAS", "WYCENA", ""].map((heading, index) => <th key={index} className="pb-4 font-medium">{heading}</th>)}</tr></thead>
                <tbody>{price.selected.map((service) => <tr key={service.id} className="h-[79px]">
                  <td className="w-[47%] pr-3"><p className="text-df-strong">{service.name}</p><p className="mt-1 text-df-label text-df-muted">{service.description}</p></td>
                  <td className="text-df-muted">{pln(service.price)}</td><td className="text-df-muted">{new Decimal(service.hours).div("1.2").times(price.size.multiplier).toDecimalPlaces(1).toString().replace(".", ",")} h</td>
                  <td className="whitespace-nowrap text-df-strong">{pln(new Decimal(service.price).times(price.multiplier))}</td>
                  <td><button type="button" aria-label={`Usuń: ${service.name}`} onClick={() => toggleService(service.id)} className="ml-1 min-h-9 min-w-7 text-df-muted hover:text-df-error">×</button></td>
                </tr>)}</tbody>
              </table></div>
              {!price.selected.length && <p role="status" className="py-3 text-df-amber">Dodaj co najmniej jedną usługę, aby przejść do wyboru terminu.</p>}
            </Panel>
            <Panel><label className="flex flex-col gap-4"><span className="text-df-strong">Uwagi do wyceny</span>
              <textarea maxLength={2000} rows={3} className="w-full resize-y rounded-lg bg-transparent text-df-body text-df-muted" value={draft.notes} onChange={(event) => update({ notes: event.target.value })} /></label></Panel>
          </>}

          {draft.step === 3 && <>
            <Panel className="flex flex-col gap-4"><h2 className="text-df-section">Wybierz termin z kalendarza</h2>
              <p className="text-df-label text-df-muted">Kalendarz demonstracyjny · październik 2026 · godziny pracy 08:00–18:00</p>
              <fieldset><legend className="sr-only">Dostępne terminy</legend><div className="flex flex-col gap-3">{slots.map((item) => {
                const unavailable = price.hours.gt(item.hours);
                return <label key={item.id} className={cn("flex items-center gap-3 rounded-lg border p-4", unavailable ? "cursor-not-allowed border-df-line opacity-40" : draft.slotId === item.id ? "border-df-muted bg-df-line" : "cursor-pointer border-df-line bg-df-raised")}>
                  <input type="radio" name="slot" checked={draft.slotId === item.id && !unavailable} disabled={unavailable} onChange={() => update({ slotId: item.id })} className="accent-df-lime" />
                  <span><span className="block text-df-strong">{item.label}</span><span className="mt-1 block text-df-label text-df-muted">{item.bay} · odbiór {item.pickup}{unavailable && " · za mało czasu"}</span></span>
                </label>;
              })}</div></fieldset>
              {!validSlot && <p role="alert" className="text-df-amber">Wybierz termin mieszczący szacowany czas pracy.</p>}
            </Panel>
            <Panel className="flex flex-col gap-4"><h2 className="text-df-section">Podgląd wiadomości</h2>
              <p className="text-df-label text-df-muted">Do: {client.name} · {client.email}</p>
              <div className="space-y-4 rounded-lg bg-df-bg p-4 leading-relaxed">
                <p>Dzień dobry, przesyłamy wycenę dla {vehicle.label}.</p>
                <ul className="list-inside list-disc">{price.selected.map((service) => <li key={service.id}>{service.name}</li>)}</ul>
                <p>Łącznie: <strong>{pln(price.gross)} brutto</strong> (w tym VAT 23%: {pln(price.vat)}).</p>
                {validSlot && <p>Przyjęcie: {slot.start}. Planowany odbiór: {slot.pickup}. {slot.bay}.</p>}
                {draft.notes && <p className="whitespace-pre-wrap">{draft.notes}</p>}
                <p>Do zobaczenia w studiu!</p>
              </div>
              <p className="text-df-label text-df-muted">Wycena zostanie wysłana e-mailem. Portal klienta jest w przygotowaniu. Proponowany termin nie rezerwuje boksu.</p>
              <label className="flex items-start gap-3"><input type="checkbox" className="mt-0.5 accent-df-lime" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />Sprawdziłem dane klienta, zakres usług i termin.</label>
            </Panel>
          </>}
        </div>

        <aside aria-label="Podsumowanie" className="flex min-w-0 flex-col gap-4">
          <Panel className="flex flex-col items-start gap-3"><h2 className="text-df-section">Podsumowanie wyceny</h2><Badge variant="draft" />
            <p className="text-df-muted">{price.selected.length} {price.selected.length === 1 ? "usługa" : price.selected.length < 5 && price.selected.length > 0 ? "usługi" : "usług"} · {price.hours.toDecimalPlaces(1).toString().replace(".", ",")} h pracy</p>
            <dl className="flex w-full flex-col gap-3 border-y border-df-line py-3">{[["Cena bazowa", pln(price.base)], ["Wielkość auta", `× ${price.size.multiplier.replace(".", ",")}`], ["Stan lakieru", `× ${price.paint.multiplier.replace(".", ",")}`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <output aria-label="Kwota brutto" aria-live="polite" className="text-df-headline">{pln(price.gross)}</output>
            <p className="text-df-label text-df-muted">Brutto, w tym VAT 23%: {pln(price.vat)}</p>
            <p className="text-df-label text-df-muted">Wyślesz wycenę po wyborze terminu w kroku 3.</p>
          </Panel>
          <Panel className="flex flex-col gap-4"><h2 className="text-df-section">Proponowany termin</h2>
            {validSlot ? <><p className="text-df-strong">{slot.label}</p><p className="text-df-muted">{slot.bay}</p><p className="text-df-label text-df-muted">Planowany odbiór: {slot.pickup}</p></> : <p className="text-df-muted">Wybierz termin w kroku 3.</p>}
            <Button variant="secondary" className="h-10 text-df-label" disabled={!price.selected.length} onClick={() => go(3)}>Sprawdź kalendarz ↗</Button>
          </Panel>
        </aside>
      </div>
      <footer className="flex flex-wrap items-center gap-3 rounded-[14px] bg-df-raised px-5 py-3.5">
        <p className="min-w-[180px] flex-1 text-df-muted">Krok {draft.step} z 3 · zmiany zapisują się automatycznie</p>
        <Button variant="secondary" disabled={draft.step === 1} onClick={() => go((draft.step - 1) as Draft["step"])} className="h-10 text-df-label">← Wstecz</Button>
        {draft.step < 3 ? <Button className="h-10 text-df-label" disabled={draft.step === 2 && !price.selected.length} onClick={() => go((draft.step + 1) as Draft["step"])}>{draft.step === 1 ? "Dalej: wybierz usługi →" : "Dalej: wybierz termin →"}</Button> : <Button className="h-10 text-df-label" disabled={busy || !confirmed || !validSlot || !price.selected.length} onClick={() => void submit()}>{busy ? "Zapisywanie…" : "Potwierdź wysyłkę"}</Button>}
      </footer>
    </fieldset>}
    <Sheet open={catalog} onClose={() => setCatalog(false)} title="Katalog usług">
      <p className="text-df-muted">Zaznacz usługi, które chcesz uwzględnić w wycenie.</p>
      {services.map((service) => <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-df-raised p-4"><input type="checkbox" className="accent-df-lime" checked={draft.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span className="flex-1"><span className="block text-df-strong">{service.name}</span><span className="block text-df-label text-df-muted">{service.description}</span></span><span>{pln(service.price)}</span></label>)}
      <form key={editingServiceId} className="flex flex-col gap-3" onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        const id = String(fields.get("serviceId"));
        const edit = { name: String(fields.get("name")), basePrice: String(fields.get("basePrice")).replace(",", "."), durationMin: Number(fields.get("durationMin")) };
        setBusy(true);
        try {
          const result = await updateServiceAction(studioId, id, edit);
          if (!result.ok) throw new Error(result.error);
          setServices((current) => current.map((service) => service.id === id ? { ...service, name: edit.name, price: edit.basePrice, durationMin: edit.durationMin, hours: new Decimal(edit.durationMin).times("1.2").div(60).toString() } : service));
          setError(""); form.reset();
        } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać usługi."); }
        finally { setBusy(false); }
      }}>
        <h3 className="text-df-strong">Edytuj usługę katalogu</h3>
        <Field label="Usługa do edycji"><select required name="serviceId" value={editingServiceId} onChange={(event) => setEditingServiceId(event.target.value)} className={control}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
        <Field label="Nazwa usługi"><input required name="name" defaultValue={editingService?.name} maxLength={120} className={control} /></Field>
        <Field label="Cena bazowa brutto PLN"><input required name="basePrice" defaultValue={editingService?.price} inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" className={control} /></Field>
        <Field label="Czas bazowy (min)"><input required name="durationMin" defaultValue={editingService?.durationMin} type="number" min={0} max={60000} className={control} /></Field>
        <Button type="submit" variant="secondary" disabled={busy}>Zapisz usługę</Button>
      </form>
      <Button onClick={() => setCatalog(false)} disabled={busy}>Gotowe</Button>
    </Sheet>
  </div>;
}
