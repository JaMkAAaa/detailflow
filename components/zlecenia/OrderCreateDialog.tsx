"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OrderClientChoice = { id: string; name: string; vehicles: { id: string; label: string }[] };
export type OrderServiceChoice = { id: string; name: string; basePrice: string };
type Props = { studioId: string; clients: OrderClientChoice[]; services: OrderServiceChoice[]; onCreated: (order: unknown) => void; onClose: () => void };

const control = "h-11 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text";
function localInput(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(" ", "T");
}

export function OrderCreateDialog({ studioId, clients, services, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(clients[0]?.vehicles[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [totalGross, setTotalGross] = useState(services[0]?.basePrice ?? "");
  const [scheduledFrom, setScheduledFrom] = useState(localInput(start));
  const [scheduledTo, setScheduledTo] = useState(localInput(end));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = clients.find((item) => item.id === clientId);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, vehicleId, service: services.find((item) => item.id === serviceId)?.name ?? "", totalGross: totalGross.trim().replace(",", "."), scheduledFrom, scheduledTo }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nie udało się utworzyć zlecenia.");
      onCreated(result);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć zlecenia.");
    } finally { setBusy(false); }
  }

  return (
    <dialog ref={dialog} aria-labelledby="new-order-title" onCancel={onClose} className="fixed inset-0 m-auto max-h-[calc(100%-32px)] w-[520px] max-w-[calc(100%-32px)] overflow-y-auto rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60">
      <h2 id="new-order-title" className="text-df-section">Nowe zlecenie</h2>
      {clients.length === 0 || services.length === 0 ? <p className="mt-4 text-df-body text-df-muted">Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.</p> : (
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Klient
            <select required aria-label="Klient" className={control} value={clientId} onChange={(event) => { setClientId(event.target.value); setVehicleId(clients.find((item) => item.id === event.target.value)?.vehicles[0]?.id ?? ""); }}>
              {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Auto
            <select required aria-label="Auto" className={control} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
              {(client?.vehicles ?? []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Usługa
            <select required aria-label="Usługa" className={control} value={serviceId} onChange={(event) => { const next = services.find((item) => item.id === event.target.value); setServiceId(event.target.value); if (next) setTotalGross(next.basePrice); }}>
              {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Kwota brutto (PLN)
            <input required inputMode="decimal" aria-label="Kwota brutto" pattern="[0-9]+([.,][0-9]{1,2})?" className={control} value={totalGross} onChange={(event) => setTotalGross(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-df-label text-df-muted">Termin od<input required type="datetime-local" aria-label="Termin od" className={control} value={scheduledFrom} onChange={(event) => setScheduledFrom(event.target.value)} /></label>
            <label className="flex flex-col gap-2 text-df-label text-df-muted">Termin do<input required type="datetime-local" aria-label="Termin do" className={control} value={scheduledTo} onChange={(event) => setScheduledTo(event.target.value)} /></label>
          </div>
          {error && <p role="alert" className="text-df-body text-df-error">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>Anuluj</button>
            <Button type="submit" disabled={busy || !vehicleId}>{busy ? "Zapisywanie…" : "Utwórz zlecenie"}</Button>
          </div>
        </form>
      )}
      {(clients.length === 0 || services.length === 0) && <div className="mt-5 flex justify-end"><button className={cn(buttonVariants({ variant: "secondary" }))} onClick={onClose}>Zamknij</button></div>}
    </dialog>
  );
}
