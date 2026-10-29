"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pln } from "@/components/wyceny/demo";

export type ServiceRow = {
  id: string;
  name: string;
  description: string;
  basePrice: string;
  durationMin: number;
  active: boolean;
};

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type ServiceActions = {
  create: (studioId: string, input: unknown) => Promise<Result<ServiceRow>>;
  update: (studioId: string, id: string, input: unknown) => Promise<Result<ServiceRow>>;
  remove: (studioId: string, id: string) => Promise<Result<unknown>>;
};

const blank = { name: "", description: "", basePrice: "", durationMin: "60", active: true };

export function ServicesScreen({ studioId, services: initial, actions }: {
  studioId: string;
  services: ServiceRow[];
  actions: ServiceActions;
}) {
  const [services, setServices] = useState(initial);
  const [fields, setFields] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(service: ServiceRow) {
    setEditingId(service.id);
    setPendingDelete(null);
    setError("");
    setFields({
      name: service.name,
      description: service.description,
      basePrice: service.basePrice,
      durationMin: String(service.durationMin),
      active: service.active,
    });
  }

  function resetForm() {
    setEditingId(null);
    setFields(blank);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d+$/.test(fields.durationMin)) {
      setError("Nieprawidłowe dane.");
      return;
    }
    const input = {
      name: fields.name,
      description: fields.description,
      basePrice: fields.basePrice.trim().replace(",", "."),
      durationMin: Number(fields.durationMin),
      active: fields.active,
    };
    setBusy(true);
    setError("");
    const result = editingId
      ? await actions.update(studioId, editingId, input)
      : await actions.create(studioId, input);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setServices((current) => editingId
      ? current.map((service) => service.id === result.value.id ? result.value : service)
      : [...current, result.value]);
    resetForm();
  }

  async function toggle(service: ServiceRow) {
    setBusy(true);
    setError("");
    const result = await actions.update(studioId, service.id, { active: !service.active });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setServices((current) => current.map((item) => item.id === result.value.id ? result.value : item));
    if (editingId === service.id) setFields((current) => ({ ...current, active: result.value.active }));
  }

  async function remove(service: ServiceRow) {
    setBusy(true);
    setError("");
    const result = await actions.remove(studioId, service.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setServices((current) => current.filter((item) => item.id !== service.id));
    setPendingDelete(null);
    if (editingId === service.id) resetForm();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-df-section">Usługi i cennik</h1>
        <p className="mt-2 text-df-muted">Cena bazowa jest brutto, w PLN. Zapisana wycena zostaje przy cenie z chwili zapisu.</p>
      </header>
      {error && <p role="alert" className="text-df-amber">{error}</p>}
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-xl bg-df-panel p-5">
        <h2 className="text-df-strong">{editingId ? "Edytuj usługę" : "Nowa usługa"}</h2>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Nazwa
          <Input required name="name" maxLength={120} value={fields.name} onChange={(event) => setFields({ ...fields, name: event.target.value })} />
        </label>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Opis
          <Input name="description" maxLength={280} value={fields.description} onChange={(event) => setFields({ ...fields, description: event.target.value })} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Cena bazowa brutto (PLN)
            <Input required name="basePrice" inputMode="decimal" value={fields.basePrice} onChange={(event) => setFields({ ...fields, basePrice: event.target.value })} />
          </label>
          <label className="flex flex-col gap-2 text-df-label text-df-muted">Czas bazowy (min)
            <Input required name="durationMin" inputMode="numeric" min={0} max={60000} value={fields.durationMin} onChange={(event) => setFields({ ...fields, durationMin: event.target.value })} />
          </label>
        </div>
        <label className="flex items-center gap-3 text-df-body">
          <input type="checkbox" className="accent-df-lime" checked={fields.active} onChange={(event) => setFields({ ...fields, active: event.target.checked })} />
          Widoczna przy nowych wycenach i zleceniach
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={busy}>{editingId ? "Zapisz zmiany" : "Dodaj usługę"}</Button>
          {editingId && <Button type="button" variant="secondary" disabled={busy} onClick={resetForm}>Anuluj edycję</Button>}
        </div>
      </form>
      {services.length === 0 ? (
        <p role="status" className="rounded-xl bg-df-panel p-5 text-df-muted">Brak usług w cenniku. Dodaj pierwszą — pojawi się przy nowej wycenie i nowym zleceniu. Pusta lista zostaje pusta po odświeżeniu.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {services.map((service) => (
            <li key={service.id} className="flex flex-col gap-3 rounded-xl bg-df-panel p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-df-strong">{service.name}</p>
                {service.description && <p className="mt-1 text-df-label text-df-muted">{service.description}</p>}
                <p className="mt-2 text-df-muted">{pln(service.basePrice)} · {service.durationMin} min</p>
              </div>
              <span className={service.active ? "text-df-label text-df-lime" : "text-df-label text-df-muted"}>{service.active ? "Aktywna" : "Ukryta"}</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={busy} onClick={() => edit(service)}>Edytuj: {service.name}</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void toggle(service)}>{service.active ? "Ukryj" : "Pokaż"}: {service.name}</Button>
                {pendingDelete === service.id ? (
                  <>
                    <Button type="button" disabled={busy} onClick={() => void remove(service)}>Potwierdź usunięcie: {service.name}</Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => setPendingDelete(null)}>Anuluj</Button>
                  </>
                ) : (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => setPendingDelete(service.id)}>Usuń: {service.name}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
