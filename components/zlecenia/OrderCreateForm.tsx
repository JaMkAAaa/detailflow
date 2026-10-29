"use client";

import { useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export type OrderClientChoice = { id: string; name: string; vehicles: { id: string; label: string }[] };
export type OrderServiceChoice = { id: string; name: string; basePrice: string };
/** Boks i godziny z wolnego okna kalendarza (czas lokalny `YYYY-MM-DDTHH:mm`, Europe/Warsaw). */
export type OrderSlot = { bayId: string; from: string; to: string };
type Props = {
  quote?: { id: string; clientId: string; vehicleId: string; service: string; totalGross: string };
  studioId: string; clients: OrderClientChoice[]; services: OrderServiceChoice[];
  onCreated: (order: unknown) => void; onCancel?: () => void;
  /** Podane z kalendarza: formularz tworzy rezerwację boksu, kolizja 409 zostaje w formularzu. */
  bays?: { id: string; name: string }[]; members?: { id: string; name: string }[]; slot?: OrderSlot | null;
};

const control = "h-11 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text";
export function localInput(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date).replace(" ", "T");
}

export function OrderCreateForm({ studioId, clients, services, onCreated, onCancel, bays, members, slot, quote }: Props) {
  const start = new Date(Date.now() + 60 * 60_000);
  const end = new Date(start.getTime() + 2 * 60 * 60_000);
  const [clientId, setClientId] = useState(quote?.clientId ?? clients[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(quote?.vehicleId ?? clients[0]?.vehicles[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [totalGross, setTotalGross] = useState(quote?.totalGross ?? services[0]?.basePrice ?? "");
  const [scheduledFrom, setScheduledFrom] = useState(slot?.from ?? (quote ? "" : localInput(start)));
  const [scheduledTo, setScheduledTo] = useState(slot?.to ?? (quote ? "" : localInput(end)));
  const [bayId, setBayId] = useState(slot?.bayId ?? (quote ? "" : bays?.[0]?.id) ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = clients.find((item) => item.id === clientId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(quote ? `/api/studios/${encodeURIComponent(studioId)}/quotes/${encodeURIComponent(quote.id)}/order` : `/api/studios/${encodeURIComponent(studioId)}/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, vehicleId, service: quote ? quote.service.slice(0, 200) : services.find((item) => item.id === serviceId)?.name ?? "",
          totalGross: totalGross.trim().replace(",", "."), scheduledFrom, scheduledTo,
          ...(bays ? { bayId } : {}), ...(members ? { assigneeId: assigneeId || null } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nie udało się utworzyć zlecenia.");
      onCreated(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć zlecenia.");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-df-label text-df-muted">Klient
        <select disabled={!!quote} required aria-label="Klient" className={control} value={clientId} onChange={(event) => { setClientId(event.target.value); setVehicleId(clients.find((item) => item.id === event.target.value)?.vehicles[0]?.id ?? ""); }}>
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-df-label text-df-muted">Auto
        <select disabled={!!quote} required aria-label="Auto" className={control} value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
          {(client?.vehicles ?? []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-df-label text-df-muted">Usługa
        {quote ? <input aria-label="Usługa" className={control} readOnly value={quote.service} /> : <select required aria-label="Usługa" className={control} value={serviceId} onChange={(event) => { const next = services.find((item) => item.id === event.target.value); setServiceId(event.target.value); if (next) setTotalGross(next.basePrice); }}>
          {services.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>}
      </label>
      {!quote && services.length === 0 && <p role="status" className="text-df-muted">Brak aktywnych usług w cenniku.</p>}
      <label className="flex flex-col gap-2 text-df-label text-df-muted">Kwota brutto (PLN)
        <input readOnly={!!quote} required inputMode="decimal" aria-label="Kwota brutto" pattern="[0-9]+([.,][0-9]{1,2})?" className={control} value={totalGross} onChange={(event) => setTotalGross(event.target.value)} />
      </label>
      {bays && (
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Boks
          <select required aria-label="Boks" className={control} value={bayId} onChange={(event) => setBayId(event.target.value)}>
            <option value="">Wybierz boks</option>
            {bays.map((bay) => <option key={bay.id} value={bay.id}>{bay.name}</option>)}
          </select>
        </label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Termin od<input required type="datetime-local" aria-label="Termin od" className={control} value={scheduledFrom} onChange={(event) => setScheduledFrom(event.target.value)} /></label>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Termin do<input required type="datetime-local" aria-label="Termin do" className={control} value={scheduledTo} onChange={(event) => setScheduledTo(event.target.value)} /></label>
      </div>
      {members && (
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Pracownik
          <select aria-label="Pracownik" className={control} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>
            <option value="">Nieprzypisane</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
      )}
      {error && <p role="alert" className="text-df-body text-df-error">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onCancel}>Anuluj</button>}
        <Button type="submit" disabled={busy || !vehicleId || (bays !== undefined && !bayId)}>{busy ? "Zapisywanie…" : "Utwórz zlecenie"}</Button>
      </div>
    </form>
  );
}
