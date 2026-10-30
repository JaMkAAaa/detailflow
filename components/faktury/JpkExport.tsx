"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { envLabel, type Environment } from "./model";

export function JpkExport({ studioId, env, now }: { studioId: string; env: Environment; now: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/studios/${studioId}/invoices/jpk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...values, env }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "Nie udało się pobrać JPK."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `JPK_FA-4-${values.from}-${values.to}-${env}.xml`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nie udało się pobrać JPK."); }
    finally { setBusy(false); }
  }
  return <div>
    <Button variant="secondary" className="h-10 text-df-label" aria-expanded={open} onClick={() => setOpen(!open)}>Eksport JPK</Button>
    {open && <form onSubmit={submit} className="mt-3 max-w-xl space-y-3 rounded-xl border border-df-line bg-df-panel p-4">
      <h2 className="font-semibold">Eksport JPK_FA(4) · {envLabel(env)}</h2>
      <p className="text-df-label text-df-muted">Wystawione faktury i korekty według daty wystawienia (Europe/Warsaw). Dane urzędu i adresu dotyczą studia. Nazwa, NIP, miejscowość i kod pocztowy pochodzą z danych studia. Plik nie jest wysyłany do urzędu.</p>
      <div className="grid grid-cols-2 gap-3">
        {([['from', 'Od', today.slice(0, 8) + '01'], ['to', 'Do', today]] as const).map(([name, label, value]) => <label key={name} className="text-df-label">{label}<input type="date" name={name} defaultValue={value} required className="mt-1 block w-full rounded-lg bg-df-raised p-2" /></label>)}
        {([['office', 'Kod urzędu skarbowego', 4], ['province', 'Województwo', 36], ['county', 'Powiat', 36], ['municipality', 'Gmina', 36], ['street', 'Ulica (opcjonalnie)', 65], ['building', 'Numer budynku', 9], ['apartment', 'Numer lokalu (opcjonalnie)', 10]] as const).map(([name, label, maxLength]) => <label key={name} className="text-df-label">{label}<input name={name} maxLength={maxLength} pattern={name === 'office' ? '[0-9]{4}' : undefined} required={!['street', 'apartment'].includes(name)} className="mt-1 block w-full rounded-lg bg-df-raised p-2" /></label>)}
      </div>
      <p role="alert" className="text-df-label text-df-error">{error}</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Generowanie…" : "Pobierz XML"}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Anuluj</Button></div>
    </form>}
  </div>;
}
