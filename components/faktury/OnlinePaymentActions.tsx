"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OnlinePaymentActions({ studioId, invoiceId }: { studioId: string; invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const router = useRouter();
  async function act(expire: boolean) {
    setBusy(true); setMessage(""); setUrl("");
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/invoices/${encodeURIComponent(invoiceId)}/checkout`, { method: expire ? "DELETE" : "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się obsłużyć płatności.");
      if (expire) setMessage("Otwarta sesja została anulowana. Możesz oznaczyć przelew ręczny.");
      else { setUrl(data.url); setMessage("Link sandbox gotowy do przekazania klientowi. Nie pobiera realnych środków."); }
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Błąd płatności."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl bg-df-panel p-4 print:hidden" aria-label="Płatność online"><p className="text-df-label text-df-muted">Płatność online · sandbox · odbiorca: studio</p><div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={busy} onClick={() => void act(false)}>Utwórz link płatności</Button><Button variant="secondary" disabled={busy} onClick={() => void act(true)}>Anuluj otwartą płatność online</Button></div>{url && <label className="block text-df-label">Link dla klienta<input className="mt-2 w-full rounded border border-df-line bg-df-bg p-3" readOnly value={url} onFocus={event => event.target.select()} /></label>}{message && <p role="status" className="text-df-label text-df-amber">{message}</p>}</section>;
}
