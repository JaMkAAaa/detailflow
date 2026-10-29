"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
export function RetryInvoiceButton({ studioId, invoiceId }: { studioId: string; invoiceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function retry() {
    setBusy(true);
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/invoices/${encodeURIComponent(invoiceId)}/ksef/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      setMessage(response.ok ? "Faktura jest w kolejce KSeF." : response.status === 429 ? "Zbyt wiele prób. Spróbuj później." : "Nie można ponowić wysyłki. Sprawdź dane i stan faktury w „Wymagają uwagi”.");
      if (response.ok) router.refresh();
    } catch { setMessage("Nie udało się ponowić wysyłki. Spróbuj później."); }
    finally { setBusy(false); }
  }
  return <><Button variant="secondary" className="mt-1 h-8 text-df-label" disabled={busy} onClick={() => void retry()}>Ponów wysyłkę</Button>{message && <p role="status" className="text-df-label">{message}</p>}</>;
}
