"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/studio/Sheet";
import { useMobile } from "@/components/studio/useMobile";
import { MobileQuoteStep } from "./MobileQuoteStep";
import { cn } from "@/lib/utils";
import { clients as demoClients, services as demoServices, sizes, paints, slots, initialDraft, draftKey, draftSchema, preview, pln, type Draft, type WizardService } from "./demo";

const control = "h-[43px] w-full min-w-0 rounded-lg bg-df-raised px-3 text-df-body text-df-text";
function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl bg-df-panel p-5", className)}>{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2 text-df-label text-df-muted">{label}{children}</label>;
}

type ClientChoice = { id: string; name: string; email: string | null; vehicles: readonly { id: string; label: string }[] };
type InitialQuote = {
  id: string;
  revision: number;
  status: string;
  pending: boolean;
  items: readonly { serviceId: string | null; name: string; basePrice: string; durationMin: number | null }[];
  draft: Draft;
};

export function QuoteWizard({ studioId, userId, clientChoices, serviceChoices, initialQuote }: {
  studioId: string;
  userId: string;
  clientChoices?: readonly ClientChoice[];
  serviceChoices?: readonly WizardService[];
  initialQuote?: InitialQuote | null;
}) {
  const mobile = useMobile();
  const [options, setOptions] = useState(false);
  const clients = clientChoices ?? demoClients;
  const operational = clientChoices !== undefined;
  const availableServices = serviceChoices ?? demoServices;
  const defaultServiceIds = operational
    ? availableServices.filter((service) => ["correction", "ceramic"].includes(service.code ?? service.id)).map((service) => service.id)
    : initialDraft.serviceIds;
  const blankStart: Draft = operational ? { ...initialDraft, clientId: clients[0]?.id ?? "", vehicleId: clients[0]?.vehicles[0]?.id ?? "", serviceIds: defaultServiceIds } : initialDraft;
  const start = initialQuote?.draft ?? blankStart;
  const [draft, setDraft] = useState<Draft>(start);
  const [services, setServices] = useState<WizardService[]>(() => {
    const base = serviceChoices ?? demoServices;
    if (!initialQuote) return [...base];
    return base.map((service) => {
      const snapshot = initialQuote.items.find((item) => item.serviceId === service.id);
      if (!snapshot) return service;
      return {
        ...service,
        name: snapshot.name,
        price: snapshot.basePrice,
        hours: snapshot.durationMin !== null ? new Decimal(snapshot.durationMin).times("1.2").div(60).toString() : service.hours,
      };
    });
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [serverStatus, setServerStatus] = useState(initialQuote?.status ?? "draft");
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(initialQuote ? (initialQuote.pending ? "Wiadomość oczekuje na wysyłkę" : initialQuote.status === "sent" ? "✓ Wysłano wycenę" : "✓ Zapisano szkic w studiu") : "Odczytywanie szkicu…");
  const [catalog, setCatalog] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(services[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [complete, setComplete] = useState(!!initialQuote && initialQuote.status !== "draft");
  const [restoreError, setRestoreError] = useState("");
  const title = useRef<HTMLHeadingElement>(null);
  const key = draftKey(studioId, userId);
  const price = preview(draft, services);
  const client = clients.find((client) => client.id === draft.clientId);
  const vehicle = client?.vehicles.find((vehicle) => vehicle.id === draft.vehicleId);
  const slot = slots.find((slot) => slot.id === draft.slotId);
  const validSlot = slot && price.hours.lte(slot.hours);
  const editingService = services.find((service) => service.id === editingServiceId) ?? services[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw && !initialQuote) {
        const result = draftSchema.safeParse(JSON.parse(raw));
        if (result.success && clients.some((client) => client.id === result.data.clientId && client.vehicles.some((vehicle) => vehicle.id === result.data.vehicleId)) && result.data.serviceIds.every((id) => services.some((service) => service.id === id))) {
          const restored = result.data;
          if (restored.step === 3 && restored.serviceIds.length === 0) restored.step = 2;
          setDraft(restored);
          if (operational && restored.quoteId) {
            setBusy(true);
            fetch(`/api/studios/${studioId}/quotes/${restored.quoteId}`).then(async (response) => {
              if (!response.ok) throw new Error("Nie udało się odczytać zapisanej wyceny.");
              const quote = await response.json();
              setServerStatus(quote.status);
              if (quote.status !== "draft") setComplete(true);
            }).catch((error: Error) => setError(error.message)).finally(() => setBusy(false));
          }
        } else setRestoreError("Nie udało się odtworzyć szkicu. Wczytano dane początkowe.");
      }
    } catch {
      setRestoreError("Nie udało się odczytać szkicu z tej przeglądarki.");
    }
    setReady(true);
    // Odtworzenie dotyczy wyłącznie aktywnego studia/użytkownika; późniejsze
    // zmiany katalogu nie mogą nadpisać bieżącego szkicu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      if (!complete) setSaved(`✓ Zapisano lokalnie · ${new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
    } catch {
      setSaved("Nie zapisano szkicu — pamięć przeglądarki jest niedostępna.");
    }
  }, [draft, key, ready, complete]);

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

  async function persist(send = false) {
    if (price.selected.some((service) => !/^\d{1,8}(\.\d{1,2})?$/.test(priceInputs[service.id] ?? service.price))) {
      setError("Wpisz poprawną cenę bazową z maksymalnie dwoma miejscami po przecinku.");
      return;
    }
    setBusy(true); setError("");
    try {
      const id = draft.quoteId ?? crypto.randomUUID();
      const next = { ...draft, quoteId: id };
      setDraft(next);
      // Przechowaj ID przed żądaniem, by timeout/reload nie tworzył drugiej wyceny.
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Zapis serwerowy nadal działa. */ }
      const base = `/api/studios/${studioId}/quotes/${id}`;
      async function request(url: string, method: string, body?: unknown) {
        const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Nie udało się zapisać wyceny.");
        return result;
      }
      if (serverStatus === "draft") {
        await request(base, "PUT", { clientId: draft.clientId, vehicleId: draft.vehicleId, size: draft.size,
          paintMult: price.paint.multiplier, interior: draft.interior, slotId: draft.slotId, step: draft.step, notes: draft.notes,
          items: price.selected.map((service) => ({ name: service.name, basePrice: service.price,
            durationMin: new Decimal(service.hours).times(60).div("1.20").toNumber() })) });
        setSaved("✓ Zapisano szkic na serwerze");
      }
      if (send) {
        await request(`${base}/send`, "POST");
        setServerStatus("sent"); setComplete(true);
        setSaved("✓ Wysłano wycenę");
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać wyceny."); }
    finally { setBusy(false); }
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operational) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const id = String(fields.get("serviceId"));
    const edit = { name: String(fields.get("name")), basePrice: String(fields.get("basePrice")).replace(",", "."), durationMin: Number(fields.get("durationMin")) };
    setBusy(true); setError("");
    try {
      const { updateServiceAction } = await import("@/app/(studio)/quotes/new/actions");
      const result = await updateServiceAction(studioId, id, edit);
      if (!result.ok) throw new Error(result.error);
      setServices((current) => current.map((service) => service.id === id ? { ...service, name: edit.name, price: edit.basePrice, durationMin: edit.durationMin, hours: new Decimal(edit.durationMin).times("1.2").div(60).toString() } : service));
      form.reset();
    } catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać usługi."); }
    finally { setBusy(false); }
  }

  function newQuote() {
    setDraft(blankStart);
    setServices([...(serviceChoices ?? demoServices)]);
    setPriceInputs({});
    setServerStatus("draft");
    setComplete(false);
    setConfirmed(false);
    setError("");
    setSaved("✓ Nowy szkic");
  }

  if (!ready) return <p role="status" className="text-df-muted">Odczytywanie szkicu wyceny…</p>;

  if (!client || !vehicle) return <p role="status">Dodaj klienta z samochodem w zakładce Klienci, aby przygotować wycenę.</p>;

  return <fieldset disabled={busy} aria-busy={busy} className="flex min-w-0 flex-col gap-6 border-0 p-0">
    {mobile && draft.step === 2 && !complete ? <MobileQuoteStep draft={draft} client={client.name} vehicle={vehicle.label} update={update} toggle={toggleService} catalog={() => setCatalog(true)} changeClient={() => go(1)} next={() => go(3)} options={() => setOptions(true)} /> : <>
    {operational && <Link href="/quotes" className="text-df-label text-df-lime">Wszystkie wyceny</Link>}
    <header className="flex min-h-[70px] flex-wrap items-start justify-between gap-3">
      <div><h1 ref={title} tabIndex={-1} className="text-df-headline">Nowa wycena</h1>
        <p className="mt-1 text-df-muted">Od potrzeb klienta do konkretnej ceny. Bez liczenia w Excelu.</p></div>
      <p role="status" className="text-df-label text-df-muted">{saved}</p>
    </header>
    {error && <p role="alert" className="text-df-amber">{error}</p>}
    {restoreError && <p role="alert" className="text-df-amber">{restoreError}</p>}
    <nav aria-label="Kroki wyceny"><ol className="flex flex-wrap items-center gap-3">
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
      <Badge variant="completed">{operational ? (({ accepted: "Zaakceptowana", rejected: "Odrzucona", expired: "Wygasła" } as Record<string, string>)[serverStatus] ?? "Wysłana") : "Potwierdzono w trybie demonstracyjnym"}</Badge>
      <h2 className="text-df-section">{operational ? "Wycena zapisana i przekazana do wysyłki" : "Wycena gotowa do wysłania"}</h2>
      <p>{client.name} · {vehicle.label} · {pln(price.gross)}</p>
      <p className="text-df-muted">{operational ? "Worker wyśle e-mail z linkiem do portalu klienta. Termin nie został zarezerwowany." : "To demonstracja interfejsu. Wiadomość nie została wysłana, a termin nie został zarezerwowany. Szkic jest zapisany lokalnie w tej przeglądarce."}</p>
      {operational ? <><Button disabled={busy || serverStatus !== "sent"} onClick={() => void persist(true)}>Wyślij ponownie</Button><Button variant="secondary" onClick={newQuote}>Nowa wycena</Button></> : <Button variant="secondary" onClick={() => { setComplete(false); setConfirmed(false); }}>Wróć do wyceny</Button>}
    </Panel> : <>
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
                  <td className="w-[47%] pr-3">{operational ? <input aria-label={`Nazwa: ${service.name}`} className={control} maxLength={120} value={service.name} onChange={(event) => update({ edits: { ...draft.edits, [service.id]: { name: event.target.value, price: service.price } } })} /> : <p className="text-df-strong">{service.name}</p>}<p className="mt-1 text-df-label text-df-muted">{service.description}</p></td>
                  <td className="text-df-muted">{operational ? <input aria-label={`Cena bazowa: ${service.name}`} className={control} type="number" min="0" max="99999999.99" step="0.01" value={priceInputs[service.id] ?? service.price} onChange={(event) => { const value = event.target.value; setPriceInputs((current) => ({ ...current, [service.id]: value })); if (/^\d{1,8}(\.\d{1,2})?$/.test(value)) update({ edits: { ...draft.edits, [service.id]: { name: service.name, price: value } } }); }} /> : pln(service.price)}</td><td className="text-df-muted">{new Decimal(service.hours).div("1.2").times(price.size.multiplier).toDecimalPlaces(1).toString().replace(".", ",")} h</td>
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
                {!operational && validSlot && <p>Przyjęcie: {slot.start}. Planowany odbiór: {slot.pickup}. {slot.bay}.</p>}
                {draft.notes && <p className="whitespace-pre-wrap">{draft.notes}</p>}
                <p>Do zobaczenia w studiu!</p>
              </div>
              <p className="text-df-label text-df-muted">{operational ? "Wiadomość zawiera link do portalu ważny 14 dni. Termin demonstracyjny nie rezerwuje boksu." : "Tryb demonstracyjny: potwierdzenie nie wysyła wiadomości i nie rezerwuje boksu."}</p>
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
        <p className="min-w-[180px] flex-1 text-df-muted">Krok {draft.step} z 3 · szkic zapisujesz na serwerze</p>
        {operational && <Button variant="secondary" disabled={busy || !price.selected.length} onClick={() => void persist()}>Zapisz szkic</Button>}
        <Button variant="secondary" disabled={draft.step === 1 || busy} onClick={() => go((draft.step - 1) as Draft["step"])} className="h-10 text-df-label">← Wstecz</Button>
        {draft.step < 3 ? <Button className="h-10 text-df-label" disabled={draft.step === 2 && !price.selected.length} onClick={() => go((draft.step + 1) as Draft["step"])}>{draft.step === 1 ? "Dalej: wybierz usługi →" : "Dalej: wybierz termin →"}</Button> : <Button className="h-10 text-df-label" disabled={busy || !confirmed || !validSlot || !price.selected.length} onClick={() => { if (operational) void persist(true); else { setComplete(true); title.current?.focus(); } }}>{operational ? "Wyślij wycenę" : "Potwierdź wysyłkę (demo)"}</Button>}
      </footer>
    </>}
    </>}
    {mobile && draft.step === 2 && restoreError && <p role="alert" className="text-df-amber">{restoreError}</p>}
    {mobile && draft.step === 2 && error && <p role="alert" className="text-df-amber">{error}</p>}
    <Sheet open={options} onClose={() => setOptions(false)} title="Rozszerzone opcje · v1.1"><p className="text-df-muted">Dodatkowe opcje lakieru i wnętrza na telefonie będą dostępne w wersji 1.1. Możesz teraz kontynuować wycenę.</p><Button onClick={() => setOptions(false)}>Wróć do wyceny</Button></Sheet>
    <Sheet open={catalog} onClose={() => setCatalog(false)} title="Katalog usług">
      <p className="text-df-muted">Zaznacz usługi, które chcesz uwzględnić w wycenie.</p>
      {services.map((service) => <label key={service.id} className="flex cursor-pointer items-center gap-3 rounded-lg bg-df-raised p-4"><input type="checkbox" className="accent-df-lime" checked={draft.serviceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span className="flex-1"><span className="block text-df-strong">{service.name}</span><span className="block text-df-label text-df-muted">{service.description}</span></span><span>{pln(service.price)}</span></label>)}
      {operational && <form className="flex flex-col gap-3" onSubmit={saveService}>
        <h3 className="text-df-strong">Edytuj usługę katalogu</h3>
        <Field label="Usługa do edycji"><select required name="serviceId" value={editingService?.id ?? ""} onChange={(event) => setEditingServiceId(event.target.value)} className={control}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></Field>
        <Field label="Nazwa usługi"><input required name="name" defaultValue={editingService?.name} key={`name-${editingService?.id}`} maxLength={120} className={control} /></Field>
        <Field label="Cena bazowa brutto PLN"><input required name="basePrice" defaultValue={editingService?.price} key={`price-${editingService?.id}`} inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" className={control} /></Field>
        <Field label="Czas bazowy (min)"><input required name="durationMin" defaultValue={editingService?.durationMin ?? 0} key={`duration-${editingService?.id}`} type="number" min={0} max={60000} className={control} /></Field>
        <Button type="submit" variant="secondary" disabled={busy}>Zapisz usługę</Button>
      </form>}
      <Button onClick={() => setCatalog(false)} disabled={busy}>Gotowe</Button>
    </Sheet>
  </fieldset>;
}
