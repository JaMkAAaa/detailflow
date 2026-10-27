"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DuplicatePlateWarning } from "@/src/server/klienci/clients";

const field = "flex flex-col gap-1.5";
const label = "text-df-label text-df-muted";

function Warnings({ warnings }: { warnings: DuplicatePlateWarning[] }) {
  if (!warnings.length) return null;
  return (
    <ul role="status" className="space-y-1 text-df-body text-df-amber">
      {warnings.map((warning) => (
        <li key={`${warning.plate}-${warning.existing.map((item) => item.vehicleId).join("-")}`}>
          Tablica {warning.plate} jest już w bazie
          ({warning.existing.map((item) => `${item.clientName} · ${item.plate}`).join(", ")}). Zapisano mimo to.
        </li>
      ))}
    </ul>
  );
}

async function send(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Nie udało się zapisać.");
  return data as { warnings?: DuplicatePlateWarning[] };
}

function text(form: FormData, key: string) {
  const value = String(form.get(key) ?? "").trim();
  return value || null;
}

export function ClientForm({ studioId, client }: {
  studioId: string;
  client?: {
    id: string; name: string; email: string | null; phone: string | null;
    street: string | null; postal: string | null; city: string | null; nip: string | null; isRegular: boolean;
  };
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<DuplicatePlateWarning[]>([]);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(client);
  async function onSubmit(form: HTMLFormElement) {
    const fields = new FormData(form);
    setError(""); setWarnings([]); setBusy(true);
    const payload: Record<string, unknown> = {
      name: String(fields.get("name") ?? "").trim(),
      email: text(fields, "email"),
      phone: text(fields, "phone"),
      street: text(fields, "street"),
      postal: text(fields, "postal"),
      city: text(fields, "city"),
      nip: text(fields, "nip"),
      isRegular: fields.get("isRegular") === "on",
    };
    if (!editing) {
      const make = text(fields, "make");
      const model = text(fields, "model");
      const plate = text(fields, "plate");
      if (make && model && plate) payload.vehicle = { make, model, plate, color: text(fields, "color") };
    }
    try {
      const data = await send(
        editing ? `/api/studios/${studioId}/clients/${client!.id}` : `/api/studios/${studioId}/clients`,
        editing ? "PATCH" : "POST",
        payload,
      );
      if (data.warnings?.length) setWarnings(data.warnings);
      const id = editing ? client!.id : (data as { id: string }).id;
      router.push(`/customers/${id}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać.");
    } finally { setBusy(false); }
  }
  return (
    <form className="flex max-w-xl flex-col gap-3" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
      <div className={field}><label className={label} htmlFor="name">Imię i nazwisko</label><Input id="name" name="name" required defaultValue={client?.name} maxLength={120} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={field}><label className={label} htmlFor="phone">Telefon</label><Input id="phone" name="phone" defaultValue={client?.phone ?? ""} maxLength={32} /></div>
        <div className={field}><label className={label} htmlFor="email">E-mail</label><Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} maxLength={254} /></div>
      </div>
      <div className={field}><label className={label} htmlFor="street">Ulica</label><Input id="street" name="street" defaultValue={client?.street ?? ""} maxLength={120} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={field}><label className={label} htmlFor="postal">Kod</label><Input id="postal" name="postal" defaultValue={client?.postal ?? ""} maxLength={12} /></div>
        <div className={field}><label className={label} htmlFor="city">Miasto</label><Input id="city" name="city" defaultValue={client?.city ?? ""} maxLength={80} /></div>
      </div>
      <div className={field}><label className={label} htmlFor="nip">NIP</label><Input id="nip" name="nip" defaultValue={client?.nip ?? ""} maxLength={20} /></div>
      <label className="flex items-center gap-2 text-df-body text-df-text">
        <input type="checkbox" name="isRegular" defaultChecked={client?.isRegular} className="size-4 accent-df-lime" />
        Stały klient
      </label>
      {!editing && (
        <fieldset className="grid gap-3 rounded-xl border border-df-line p-4 sm:grid-cols-2">
          <legend className="px-1 text-df-label text-df-muted">Auto (opcjonalnie)</legend>
          <div className={field}><label className={label} htmlFor="make">Marka</label><Input id="make" name="make" maxLength={80} /></div>
          <div className={field}><label className={label} htmlFor="model">Model</label><Input id="model" name="model" maxLength={80} /></div>
          <div className={field}><label className={label} htmlFor="plate">Tablica</label><Input id="plate" name="plate" maxLength={16} /></div>
          <div className={field}><label className={label} htmlFor="color">Kolor</label><Input id="color" name="color" maxLength={40} /></div>
        </fieldset>
      )}
      {error && <p role="alert" className="text-df-body text-df-error">{error}</p>}
      <Warnings warnings={warnings} />
      <Button type="submit" loading={busy} loadingLabel="Zapisywanie…">{editing ? "Zapisz klienta" : "Dodaj klienta"}</Button>
    </form>
  );
}

export function VehicleForm({ studioId, clientId }: { studioId: string; clientId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<DuplicatePlateWarning[]>([]);
  const [busy, setBusy] = useState(false);
  async function onSubmit(form: HTMLFormElement) {
    const fields = new FormData(form);
    setError(""); setWarnings([]); setBusy(true);
    try {
      const data = await send(`/api/studios/${studioId}/clients/${clientId}/vehicles`, "POST", {
        make: String(fields.get("make") ?? "").trim(),
        model: String(fields.get("model") ?? "").trim(),
        plate: String(fields.get("plate") ?? "").trim(),
        color: text(fields, "color"),
      });
      setWarnings(data.warnings ?? []);
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się dodać auta.");
    } finally { setBusy(false); }
  }
  return (
    <form className="grid max-w-xl gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
      <div className={field}><label className={label} htmlFor="v-make">Marka</label><Input id="v-make" name="make" required maxLength={80} /></div>
      <div className={field}><label className={label} htmlFor="v-model">Model</label><Input id="v-model" name="model" required maxLength={80} /></div>
      <div className={field}><label className={label} htmlFor="v-plate">Tablica</label><Input id="v-plate" name="plate" required maxLength={16} /></div>
      <div className={field}><label className={label} htmlFor="v-color">Kolor</label><Input id="v-color" name="color" maxLength={40} /></div>
      {error && <p role="alert" className="sm:col-span-2 text-df-body text-df-error">{error}</p>}
      <div className="sm:col-span-2"><Warnings warnings={warnings} /></div>
      <div className="sm:col-span-2"><Button type="submit" loading={busy} loadingLabel="Zapisywanie…">Dodaj auto</Button></div>
    </form>
  );
}

export function ImportForm({ studioId }: { studioId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  async function onSubmit(form: HTMLFormElement) {
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    setError(""); setSummary(""); setBusy(true);
    try {
      const csv = file ? await file.text() : "";
      if (!csv.trim()) throw new Error("Wybierz plik CSV.");
      const data = await send(`/api/studios/${studioId}/clients/import`, "POST", { csv }) as {
        createdClients: number; createdVehicles: number; unchanged: number; invalid: number;
        errors: { row: number; message: string }[];
        warnings: DuplicatePlateWarning[];
      };
      setSummary(`Nowe osoby: ${data.createdClients}, nowe auta: ${data.createdVehicles}, bez zmian: ${data.unchanged}, pominięte: ${data.invalid}.`);
      if (data.errors[0]) setError(data.errors.map((item) => `Wiersz ${item.row}: ${item.message}`).join(" "));
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zaimportować.");
    } finally { setBusy(false); }
  }
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void onSubmit(event.currentTarget); }}>
      <div className={field}>
        <label className={label} htmlFor="csv">Import CSV</label>
        <Input id="csv" name="file" type="file" accept=".csv,text/csv" />
      </div>
      <Button type="submit" variant="secondary" loading={busy} loadingLabel="Importowanie…">Importuj</Button>
      {summary && <p role="status" className="w-full text-df-body text-df-muted">{summary}</p>}
      {error && <p role="alert" className="w-full text-df-body text-df-error">{error}</p>}
    </form>
  );
}

export function DeleteButton({ url, label, confirm: message, href = "/customers" }: {
  url: string; label: string; confirm: string; href?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Button variant="secondary" loading={busy} loadingLabel="Usuwanie…" onClick={async () => {
        if (!window.confirm(message)) return;
        setError(""); setBusy(true);
        try {
          await send(url, "DELETE");
          if (href) router.push(href);
          router.refresh();
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Nie udało się usunąć.");
        } finally { setBusy(false); }
      }}>{label}</Button>
      {error && <p role="alert" className="mt-2 text-df-body text-df-error">{error}</p>}
    </div>
  );
}
