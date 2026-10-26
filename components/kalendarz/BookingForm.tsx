"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Order = { id: string; number: string; bayId: string | null; from: string; to: string };
export function BookingForm({ studioId, orders, bays }: {
  studioId: string; orders: Order[]; bays: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const order = orders.find((item) => item.id === orderId);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: HTMLFormElement, remove = false) {
    if (!order) return;
    setError(""); setBusy(true);
    const fields = new FormData(form);
    try {
      const response = await fetch(`/api/studios/${studioId}/bookings/${order.id}`, {
        method: remove ? "DELETE" : order.bayId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        ...(remove ? {} : { body: JSON.stringify(Object.fromEntries(fields)) }),
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
  return <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
    <p className="text-df-label text-df-muted">Terminy w strefie Europe/Warsaw. Wybierz zlecenie, aby dodać lub zmienić rezerwację.</p>
    <label className="block text-df-label">Zlecenie<select className={fieldClass} value={orderId} disabled={busy} onChange={(event) => { setOrderId(event.target.value); setError(""); }} required><option value="" disabled>Wybierz zlecenie</option>{orders.map((item) => <option key={item.id} value={item.id}>{item.number}{item.bayId ? " · zarezerwowane" : ""}</option>)}</select></label>
    {order && <div key={`${order.id}-${order.bayId}-${order.from}-${order.to}`} className="space-y-3">
      <label className="block text-df-label">Boks<select name="bayId" className={fieldClass} defaultValue={order.bayId ?? bays[0]?.id} required>{bays.map((bay) => <option key={bay.id} value={bay.id}>{bay.name}</option>)}</select></label>
      <label className="block text-df-label">Od<input name="scheduledFrom" type="datetime-local" className={fieldClass} defaultValue={order.from} required /></label>
      <label className="block text-df-label">Do<input name="scheduledTo" type="datetime-local" className={fieldClass} defaultValue={order.to} required /></label>
      <div className="flex gap-3"><Button disabled={busy || !bays.length} type="submit">{busy ? "Zapisywanie…" : "Zapisz rezerwację"}</Button>{order.bayId && <Button variant="secondary" disabled={busy} type="button" onClick={(event) => { void submit(event.currentTarget.form!, true); }}>Usuń rezerwację</Button>}</div>
    </div>}
    {!orders.length && <p className="text-df-muted">Brak aktywnych zleceń do rezerwacji.</p>}
    {!bays.length && <p className="text-df-muted">Studio nie ma boksów.</p>}
    {error && <p role="alert" className="text-df-error">{error}</p>}
  </form>;
}
