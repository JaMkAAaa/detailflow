"use client";

import { useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { OrderCreateForm, type OrderClientChoice, type OrderServiceChoice } from "@/components/zlecenia/OrderCreateForm";
import { ReservationSlotContext, type ReservationSlot } from "./slot";

type Order = { id: string; number: string; bayId: string | null; assigneeId?: string | null; from: string; to: string };
type Member = { id: string; name: string };
type Props = {
  studioId: string; orders: Order[]; bays: { id: string; name: string }[]; members?: Member[];
  clients?: OrderClientChoice[]; services?: OrderServiceChoice[];
};

/** Wolne okno z kalendarza otwiera „Nowe zlecenie” z boksem i godzinami; „Nowa rezerwacja” — istniejące zlecenie. */
export function BookingForm(props: Props) {
  const slot = useContext(ReservationSlotContext);
  return <BookingFormBody key={slot?.key ?? "none"} slot={slot} {...props} />;
}

function BookingFormBody({ studioId, orders, bays, members = [], clients = [], services = [], slot }: Props & { slot: ReservationSlot | null }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const canCreate = clients.length > 0 && services.length > 0;
  const [mode, setMode] = useState<"existing" | "new">(slot && canCreate ? "new" : "existing");
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const order = orders.find((item) => item.id === orderId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement, remove = false) {
    if (!order) return;
    setError(""); setBusy(true);
    const fields: Record<string, FormDataEntryValue | null> = Object.fromEntries(new FormData(form));
    // Pusty wybór pracownika = „Nieprzypisane”.
    if ("assigneeId" in fields) fields.assigneeId = fields.assigneeId || null;
    try {
      const response = await fetch(`/api/studios/${studioId}/bookings/${order.id}`, {
        method: remove ? "DELETE" : order.bayId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        ...(remove ? {} : { body: JSON.stringify(fields) }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Nie udało się zapisać rezerwacji.");
      } else {
        router.refresh();
        form.closest("dialog")?.close();
      }
    } catch { setError("Nie udało się połączyć z serwerem."); }
    finally { setBusy(false); }
  }
  const fieldClass = "mt-1 block w-full rounded-lg border border-df-line bg-df-raised p-2 text-df-text";
  const tab = (value: "existing" | "new", title: string) => <button type="button" aria-pressed={mode === value} onClick={() => { setMode(value); setError(""); }} className={`h-7 rounded-md border px-2.5 text-df-label ${mode === value ? "border-df-muted bg-df-line" : "border-transparent bg-df-raised text-df-muted"}`}>{title}</button>;
  return <div ref={root}>
    {canCreate && <div className="mt-4 flex gap-3" role="group" aria-label="Rodzaj rezerwacji">{tab("existing", "Istniejące zlecenie")}{tab("new", "Nowe zlecenie")}</div>}
    {mode === "new" && canCreate ? <>
      {slot && <p className="mt-3 text-df-label text-df-muted">Wolne okno {slot.from.slice(11)}–{slot.to.slice(11)}. Terminy w strefie Europe/Warsaw.</p>}
      <OrderCreateForm studioId={studioId} clients={clients} services={services} bays={bays} members={members} slot={slot}
        onCreated={() => { router.refresh(); root.current?.closest("dialog")?.close(); }} />
    </> : <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <p className="text-df-label text-df-muted">Terminy w strefie Europe/Warsaw. Wybierz zlecenie, aby dodać lub zmienić rezerwację.</p>
      <label className="block text-df-label">Zlecenie<Select className="mt-1" aria-label="Zlecenie" value={orderId} disabled={busy} placeholder="Wybierz zlecenie" onChange={(event) => { setOrderId(event.target.value); setError(""); }} required options={orders.map((item) => ({ value: item.id, label: `${item.number}${item.bayId ? " · zarezerwowane" : ""}` }))} /></label>
      {order && <div key={`${order.id}-${order.bayId}-${order.assigneeId}-${order.from}-${order.to}`} className="space-y-3">
        <label className="block text-df-label">Boks<Select className="mt-1" name="bayId" aria-label="Boks" defaultValue={order.bayId ?? bays[0]?.id ?? ""} required options={bays.map((bay) => ({ value: bay.id, label: bay.name }))} /></label>
        <label className="block text-df-label">Od<input name="scheduledFrom" type="datetime-local" className={fieldClass} defaultValue={order.from} required /></label>
        <label className="block text-df-label">Do<input name="scheduledTo" type="datetime-local" className={fieldClass} defaultValue={order.to} required /></label>
        {members.length > 0 && <label className="block text-df-label">Pracownik<Select className="mt-1" name="assigneeId" aria-label="Pracownik" defaultValue={order.assigneeId ?? ""} options={[{ value: "", label: "Nieprzypisane" }, ...members.map((member) => ({ value: member.id, label: member.name }))]} /></label>}
        <div className="flex gap-3"><Button disabled={busy || !bays.length} type="submit">{busy ? "Zapisywanie…" : "Zapisz rezerwację"}</Button>{order.bayId && <Button variant="secondary" disabled={busy} type="button" onClick={(event) => { void submit(event.currentTarget.form!, true); }}>Usuń rezerwację</Button>}</div>
      </div>}
      {!orders.length && <p className="text-df-muted">Brak aktywnych zleceń do rezerwacji.</p>}
      {!bays.length && <p className="text-df-muted">Studio nie ma boksów.</p>}
      {error && <p role="alert" className="text-df-error">{error}</p>}
    </form>}
  </div>;
}
