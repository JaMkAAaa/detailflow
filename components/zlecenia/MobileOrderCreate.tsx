"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { formatPln } from "@/lib/format-pln";
import { cn } from "@/lib/utils";
import type { OrderClientChoice, OrderServiceChoice } from "./OrderCreateForm";
import { addCalendarDays, addMinutes, dayChoices, durationLabel, initialWindow, initials, warsawLocal } from "./order-create-schedule";

type Member = { id: string; name: string };
type Bay = { id: string; name: string };
type Mode = { kind: "form" } | { kind: "clients" } | { kind: "vehicles"; clientId: string };

const amountPattern = /^\d{1,10}(?:\.\d{1,2})?$/;
const fieldClass = "h-12 w-full rounded-[14px] bg-df-raised px-3.5 text-base font-semibold text-df-text outline-none";

function grossLabel(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!amountPattern.test(normalized)) return value.trim() || "—";
  return formatPln(normalized.includes(".") ? normalized : `${normalized}.00`);
}

export function MobileOrderCreate({ studioId, studioName, clients, services, bays, members }: {
  studioId: string; studioName: string; clients: OrderClientChoice[]; services: OrderServiceChoice[]; bays: Bay[]; members: Member[];
}) {
  const router = useRouter();
  const first = services[0];
  const [range] = useState(() => initialWindow(new Date(), first?.durationMin ?? 0));
  const [mode, setMode] = useState<Mode>({ kind: "form" });
  const [query, setQuery] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [vehicleId, setVehicleId] = useState(clients[0]?.vehicles[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(first?.id ?? "");
  const [totalGross, setTotalGross] = useState(first?.basePrice ?? "");
  const [scheduledFrom, setScheduledFrom] = useState(range.from);
  const [scheduledTo, setScheduledTo] = useState(range.to);
  const [bayId, setBayId] = useState(bays[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState("");
  const [otherDay, setOtherDay] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const client = clients.find((item) => item.id === clientId);
  const vehicle = client?.vehicles.find((item) => item.id === vehicleId);
  const service = services.find((item) => item.id === serviceId);
  const today = warsawLocal(new Date()).slice(0, 10);
  const days = dayChoices(today);
  const date = scheduledFrom.slice(0, 10);
  const customDay = otherDay || !days.some((day) => day.date === date);

  function close() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  function chooseClient(next: OrderClientChoice) {
    if (next.vehicles.length <= 1) {
      setClientId(next.id);
      setVehicleId(next.vehicles[0]?.id ?? "");
      setMode({ kind: "form" });
      setQuery("");
      return;
    }
    setMode({ kind: "vehicles", clientId: next.id });
  }

  function chooseVehicle(nextClientId: string, nextVehicleId: string) {
    setClientId(nextClientId);
    setVehicleId(nextVehicleId);
    setMode({ kind: "form" });
    setQuery("");
  }

  function chooseService(next: OrderServiceChoice) {
    setServiceId(next.id);
    setTotalGross(next.basePrice);
    setScheduledTo(addMinutes(scheduledFrom, next.durationMin && next.durationMin > 0 ? next.durationMin : 120));
  }

  function applyDate(nextDate: string) {
    const fromTime = scheduledFrom.slice(11, 16);
    const toTime = scheduledTo.slice(11, 16);
    const from = `${nextDate}T${fromTime}`;
    let to = `${nextDate}T${toTime}`;
    if (to <= from) to = addMinutes(from, service?.durationMin && service.durationMin > 0 ? service.durationMin : 120);
    setScheduledFrom(from);
    setScheduledTo(to);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = totalGross.trim().replace(",", ".");
    if (!amountPattern.test(amount)) {
      setError("Podaj kwotę brutto w złotych, na przykład 2400,00.");
      return;
    }
    if (scheduledTo <= scheduledFrom) {
      setError("Koniec musi być późniejszy niż początek.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/orders`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, vehicleId, service: service?.name ?? "", totalGross: amount, scheduledFrom, scheduledTo,
          ...(bayId ? { bayId } : {}), ...(assigneeId ? { assigneeId } : {}),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nie udało się utworzyć zlecenia.");
      const number = typeof result.number === "string" ? result.number : "";
      router.push(number ? `/orders/${number}` : "/orders");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nie udało się utworzyć zlecenia.");
      setBusy(false);
    }
  }

  if (clients.length === 0 || services.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Nowe zlecenie" subtitle={studioName} onBack={close} backLabel="Zamknij" icon="close" />
        <p className="text-df-body text-df-muted">Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.</p>
      </div>
    );
  }

  if (mode.kind === "clients") {
    const needle = query.trim().toLocaleLowerCase("pl-PL");
    const found = clients.filter((item) => !needle || `${item.name} ${item.vehicles.map((car) => car.label).join(" ")}`.toLocaleLowerCase("pl-PL").includes(needle));
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Wybierz klienta" onBack={() => setMode({ kind: "form" })} backLabel="Wróć do formularza" icon="back" />
        <label className="flex items-center gap-2.5 rounded-[14px] bg-df-panel px-3.5 py-3 text-df-muted">
          <MaskIcon name="search" size={18} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Szukaj klienta" placeholder="Szukaj klienta lub auta…" className="min-w-0 flex-1 bg-transparent text-base text-df-text outline-none placeholder:text-df-muted" />
        </label>
        {found.length === 0 ? <p className="text-df-body text-df-muted">Brak pasujących klientów.</p> : (
          <ul className="overflow-hidden rounded-[18px] bg-df-panel">
            {found.map((item) => (
              <li key={item.id} className="border-b border-df-line last:border-0">
                <button type="button" onClick={() => chooseClient(item)} className="flex min-h-[62px] w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-df-lime-dark text-[13px] font-bold text-df-lime">{initials(item.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{item.name}</span>
                    <span className="block truncate text-[12px] text-df-muted">{item.vehicles.map((car) => car.label).join(", ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (mode.kind === "vehicles") {
    const picked = clients.find((item) => item.id === mode.clientId);
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Wybierz auto" subtitle={picked?.name} onBack={() => setMode({ kind: "clients" })} backLabel="Wróć do klientów" icon="back" />
        <ul className="overflow-hidden rounded-[18px] bg-df-panel">
          {(picked?.vehicles ?? []).map((car) => (
            <li key={car.id} className="border-b border-df-line last:border-0">
              <button type="button" onClick={() => chooseVehicle(mode.clientId, car.id)} className="flex min-h-[62px] w-full items-center px-4 py-3 text-left text-[15px]">{car.label}</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-[18px] pb-40">
      <PageHeader title="Nowe zlecenie" subtitle={studioName} onBack={close} backLabel="Zamknij" icon="close" />

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-df-muted">Klient i auto</h2>
        <div className="flex items-center gap-3 rounded-[18px] bg-df-panel px-4 py-3.5">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-df-lime-dark text-[14px] font-bold text-df-lime">{initials(client?.name ?? "")}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{client?.name}</span>
            <span className="block truncate text-[12px] text-df-muted">{vehicle?.label}</span>
          </span>
          <button type="button" onClick={() => { setQuery(""); setMode({ kind: "clients" }); }} className="min-h-11 shrink-0 text-[13px] font-semibold text-df-lime">Zmień</button>
        </div>
      </section>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-df-muted">Usługa</legend>
        <div className="rounded-[18px] bg-df-panel px-4">
          {services.map((item) => {
            const selected = item.id === serviceId;
            return (
              <label key={item.id} className="flex min-h-[58px] cursor-pointer items-center gap-3 border-b border-df-line py-3 last:border-0">
                <input type="radio" name="service" className="peer sr-only" checked={selected} onChange={() => chooseService(item)} />
                <span className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full border peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-df-lime", selected ? "border-df-lime bg-df-lime" : "border-df-muted")}>
                  {selected && <span className="size-2 rounded-full bg-df-bg" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px]">{item.name}</span>
                  {item.durationMin ? <span className="block text-[12px] text-df-muted">{durationLabel(item.durationMin)}</span> : null}
                </span>
                <span className={cn("shrink-0 text-[14px] font-semibold", !selected && "text-df-muted")}>{formatPln(item.basePrice)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold text-df-muted">Kwota brutto</span>
        <span className="flex h-12 items-center rounded-[14px] bg-df-raised px-3.5">
          <input required inputMode="decimal" aria-label="Kwota brutto" value={totalGross} onChange={(event) => setTotalGross(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base font-semibold text-df-text outline-none" />
          <span className="text-[13px] font-medium text-df-muted">PLN</span>
        </span>
      </label>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-df-muted">Termin</h2>
        <div role="group" aria-label="Dzień" className="flex gap-2">
          {days.map((day) => (
            <button key={day.date} type="button" aria-pressed={!customDay && date === day.date} onClick={() => { setOtherDay(false); applyDate(day.date); }} className={cn("min-w-0 flex-1 rounded-[14px] px-2 py-2.5 text-center", !customDay && date === day.date ? "bg-df-raised shadow-[inset_0_0_0_1px_var(--df-muted)]" : "bg-df-panel")}>
              <span className="block text-[14px] font-semibold">{day.title}</span>
              <span className="block text-[12px] text-df-muted">{day.dayMonth}</span>
            </button>
          ))}
        </div>
        {customDay ? (
          <input type="date" aria-label="Inny dzień" value={date} onChange={(event) => { if (event.target.value) applyDate(event.target.value); }} className={cn(fieldClass, "mt-2")} />
        ) : (
          <button type="button" onClick={() => setOtherDay(true)} className="mt-2 min-h-11 text-[13px] font-semibold text-df-lime">Inny dzień</button>
        )}
        <div className="mt-2 grid grid-cols-[1fr_16px_1fr] items-center gap-2">
          <input required type="time" aria-label="Termin od" value={scheduledFrom.slice(11, 16)} onChange={(event) => {
            if (!event.target.value) return;
            const from = `${date}T${event.target.value}`;
            setScheduledFrom(from);
            if (scheduledTo <= from) setScheduledTo(addMinutes(from, service?.durationMin && service.durationMin > 0 ? service.durationMin : 120));
          }} className={fieldClass} />
          <span className="text-center text-df-muted" aria-hidden="true">–</span>
          <input required type="time" aria-label="Termin do" value={scheduledTo.slice(11, 16)} onChange={(event) => {
            if (!event.target.value) return;
            const sameDay = `${date}T${event.target.value}`;
            setScheduledTo(sameDay <= scheduledFrom ? `${addCalendarDays(date, 1)}T${event.target.value}` : sameDay);
          }} className={fieldClass} />
        </div>
        {scheduledTo.slice(0, 10) !== date && <p className="mt-2 text-[12px] text-df-muted">Koniec wypada następnego dnia.</p>}
      </section>

      {bays.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-df-muted">Boks</legend>
          <div className="grid grid-cols-2 gap-2">
            {bays.map((bay) => (
              <label key={bay.id} className={cn("flex h-11 cursor-pointer items-center justify-center rounded-[14px] text-[14px] font-semibold", bay.id === bayId ? "bg-df-lime-dark text-df-lime" : "bg-df-panel text-df-text")}>
                <input type="radio" name="bay" className="sr-only" checked={bay.id === bayId} onChange={() => setBayId(bay.id)} />
                {bay.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {members.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-df-muted">Pracownik</span>
          <span className="relative block">
            <select value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className="h-[52px] w-full appearance-none rounded-[18px] bg-df-panel px-4 pr-10 text-[15px] text-df-text">
              <option value="">Nieprzypisane</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <MaskIcon name="chevron-right" size={18} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-df-muted" />
          </span>
        </label>
      )}

      {error && <p role="alert" className="text-df-body text-df-error">{error}</p>}

      <footer className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-3 rounded-t-[22px] bg-df-side px-4 pt-3.5 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.5)]">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[12px] text-df-muted">Razem brutto{service?.durationMin ? ` · ${durationLabel(service.durationMin)}` : ""}</p>
          <output aria-label="Razem brutto" aria-live="polite" className="text-[26px] font-bold tracking-[-0.3px]">{grossLabel(totalGross)}</output>
        </div>
        <Button type="submit" className="w-full" disabled={busy || !vehicleId || !serviceId}>{busy ? "Zapisywanie…" : "Utwórz zlecenie"}</Button>
      </footer>
    </form>
  );
}

function PageHeader({ title, subtitle, onBack, backLabel, icon }: {
  title: string; subtitle?: string; onBack: () => void; backLabel: string; icon: string;
}) {
  return (
    <header className="grid grid-cols-[44px_1fr_44px] items-center">
      <button type="button" aria-label={backLabel} onClick={onBack} className="flex size-11 items-center justify-center rounded-full bg-df-panel">
        <MaskIcon name={icon} size={20} />
      </button>
      <div className="min-w-0 text-center">
        <h1 className="text-[17px] font-semibold">{title}</h1>
        {subtitle && <p className="text-[12px] text-df-muted">{subtitle}</p>}
      </div>
      <span className="size-11" />
    </header>
  );
}
