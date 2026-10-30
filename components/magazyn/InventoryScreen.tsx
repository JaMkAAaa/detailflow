"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ChemicalRecord } from "@/src/server/magazyn/inventory";

type Result = { ok: true; value: ChemicalRecord } | { ok: false; error: string };
export type InventoryActions = {
  create: (studioId: string, input: unknown) => Promise<Result>;
  correct: (studioId: string, id: string, input: unknown) => Promise<Result>;
};
const blank = { name: "", unit: "ml" as "ml" | "piece", quantity: "0", lowThreshold: "0", reason: "" };

export function InventoryScreen({ studioId, chemicals, canManage, actions }: {
  studioId: string; chemicals: ChemicalRecord[]; canManage: boolean; actions: InventoryActions;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ChemicalRecord | null>(null);
  const [fields, setFields] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  function reset() { setEditing(null); setFields(blank); setError(""); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (![fields.quantity, fields.lowThreshold].every(value => /^\d{1,10}$/.test(value) && Number(value) <= 2_000_000_000)) {
      setError("Podaj pełne sztuki lub ml od 0 do 2 000 000 000."); return;
    }
    setBusy(true); setError("");
    try {
      const common = { quantity: Number(fields.quantity), lowThreshold: Number(fields.lowThreshold), reason: fields.reason };
      const result = editing
        ? await actions.correct(studioId, editing.id, { ...common, version: editing.version })
        : await actions.create(studioId, { ...common, name: fields.name, unit: fields.unit });
      if (!result.ok) { setError(result.error); return; }
      reset(); router.refresh();
    } catch { setError("Nie udało się zapisać zmian. Odśwież listę przed ponowieniem korekty."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto flex max-w-3xl flex-col gap-6">
    <header><h1 className="text-df-section">Magazyn chemii</h1>
      <p className="mt-2 text-df-muted">Pełne sztuki lub ml. Stan zmieniasz jawną korektą; zlecenia nie zużywają chemii automatycznie.</p>
    </header>
    {error && <p role="alert" className="text-df-amber">{error} <Button type="button" variant="secondary" disabled={busy} onClick={() => { reset(); router.refresh(); }}>Odśwież listę</Button></p>}
    {canManage ? <form onSubmit={event => void submit(event)} className="flex flex-col gap-4 rounded-xl bg-df-panel p-5">
      <h2 className="text-df-strong">{editing ? `Korekta: ${editing.name}` : "Nowa pozycja"}</h2>
      {!editing && <>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Nazwa<Input required maxLength={120} value={fields.name} onChange={e => setFields({ ...fields, name: e.target.value })} /></label>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Jednostka<Select aria-label="Jednostka" value={fields.unit} onChange={e => setFields({ ...fields, unit: e.target.value as "ml" | "piece" })} options={[{ value: "ml", label: "ml" }, { value: "piece", label: "szt." }]} /></label>
      </>}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-df-label text-df-muted">{editing ? "Nowy stan" : "Stan początkowy"}<Input required inputMode="numeric" value={fields.quantity} onChange={e => setFields({ ...fields, quantity: e.target.value })} /></label>
        <label className="flex flex-col gap-2 text-df-label text-df-muted">Próg niskiego stanu<Input required inputMode="numeric" value={fields.lowThreshold} onChange={e => setFields({ ...fields, lowThreshold: e.target.value })} /></label>
      </div>
      <label className="flex flex-col gap-2 text-df-label text-df-muted">Powód wpisu / korekty<Input required maxLength={280} value={fields.reason} onChange={e => setFields({ ...fields, reason: e.target.value })} /></label>
      {editing && <p className="text-df-muted">Obecny stan: {editing.quantity} {editing.unit === "ml" ? "ml" : "szt."}. Zapis ustawi podaną ilość.</p>}
      <div className="flex flex-wrap gap-3"><Button type="submit" loading={busy}>{editing ? "Zapisz korektę" : "Dodaj pozycję"}</Button>{editing && <Button type="button" variant="secondary" disabled={busy} onClick={reset}>Anuluj korektę</Button>}</div>
    </form> : <p className="text-df-muted">Dostęp tylko do odczytu. Korekty zapisuje właściciel lub manager z aktywnym abonamentem albo trialem.</p>}
    {chemicals.length === 0 ? <p role="status" className="rounded-xl bg-df-panel p-5 text-df-muted">Brak chemii w magazynie. Dodaj rzeczywiste pozycje i ich zmierzone stany.</p> : <ul className="flex flex-col gap-3">{chemicals.map(item => <li key={item.id} className="flex flex-col gap-3 rounded-xl bg-df-panel p-5 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1"><h2 className="break-words text-df-strong">{item.name}</h2><p className="mt-2">{item.quantity} {item.unit === "ml" ? "ml" : "szt."} · próg: {item.lowThreshold} {item.unit === "ml" ? "ml" : "szt."}</p><p className="mt-1 break-words text-df-label text-df-muted">Ostatni powód: {item.lastReason}</p></div>
      {item.quantity <= item.lowThreshold && <span className="text-df-label text-df-amber">Niski stan</span>}
      {canManage && <Button type="button" variant="secondary" disabled={busy} onClick={() => { setEditing(item); setFields({ name: item.name, unit: item.unit, quantity: String(item.quantity), lowThreshold: String(item.lowThreshold), reason: "" }); setError(""); }}>Korekta: {item.name}</Button>}
    </li>)}</ul>}
  </div>;
}
