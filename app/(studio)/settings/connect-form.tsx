"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function ConnectForm({ studioId }: { studioId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/client-payments/connect`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Nie udało się połączyć konta.");
      window.location.assign(data.url);
    } catch (error) { setError(error instanceof Error ? error.message : "Błąd Stripe."); setBusy(false); }
  }
  return <section className="space-y-3 rounded-xl bg-df-panel p-5"><h2 className="text-df-section">Płatności klientów · sandbox</h2><p className="text-df-body text-df-muted">Połącz konto Stripe Standard studia przez bezpieczny formularz Stripe. Środki trafiają do studia, które ponosi opłaty i obsługuje zwroty oraz spory. Prowizja Detailflow: 0%. To osobny obieg od abonamentu.</p><Button disabled={busy} onClick={() => void connect()}>{busy ? "Łączenie…" : "Połącz / dokończ aktywację Stripe"}</Button><p className="text-df-label text-df-muted">Powrót z formularza nie oznacza aktywacji. Gotowość konta jest sprawdzana w Stripe przy tworzeniu linku płatności. Sandbox nie pobiera realnych środków.</p>{error && <p role="alert" className="text-df-error">{error}</p>}</section>;
}
