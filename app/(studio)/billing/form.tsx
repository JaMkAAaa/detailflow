"use client";
import { BILLING_CATALOG, type BillingInterval } from "@/lib/billing/catalog";
import { useState } from "react";

export function CheckoutForm({ studioId }: { studioId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  return <form className="flex flex-col gap-4" onSubmit={async event => {
    event.preventDefault();
    const plan = new FormData(event.currentTarget).get("plan");
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/studios/${studioId}/billing/checkout`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan, interval }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się otworzyć Checkout.");
      window.location.assign(result.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nie udało się otworzyć Checkout.");
      setPending(false);
    }
  }}>
    <label htmlFor="billing-interval">Okres rozliczeń</label>
    <select id="billing-interval" value={interval} disabled={pending} onChange={e => setInterval(e.target.value as BillingInterval)} className="rounded-lg bg-df-raised p-3">
      <option value="monthly">Miesięcznie</option><option value="yearly">Rocznie — opłata z góry, automatyczne odnowienie</option>
    </select>
    <label htmlFor="billing-plan">Plan (netto PLN)</label>
    <select id="billing-plan" name="plan" disabled={pending} className="rounded-lg bg-df-raised p-3">
      {Object.entries(BILLING_CATALOG).map(([plan, config]) => <option key={plan} value={plan}>{config.name} — {config[interval]} zł / {interval === "yearly" ? "rok" : "mies."}</option>)}
    </select>
    <p className="text-df-muted">Do ceny zostanie doliczony właściwy podatek w Stripe Checkout.</p>
    <button disabled={pending} className="rounded-lg bg-df-lime p-3 text-df-bg disabled:opacity-50">{pending ? "Otwieranie…" : "Przejdź do Stripe Checkout"}</button>
    {error && <p role="alert" className="text-df-error">{error}</p>}
  </form>;
}

export function BillingPortalButton({ studioId }: { studioId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="flex flex-col gap-3">
    <button disabled={pending} className="rounded-lg bg-df-lime p-3 text-df-bg disabled:opacity-50" onClick={async () => {
      setPending(true); setError("");
      try {
        const response = await fetch(`/api/studios/${studioId}/billing/portal`, { method: "POST" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Nie udało się otworzyć portalu Stripe.");
        window.location.assign(result.url);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Nie udało się otworzyć portalu Stripe.");
        setPending(false);
      }
    }}>{pending ? "Otwieranie…" : "Zarządzaj abonamentem w Stripe"}</button>
    {error && <p role="alert" className="text-df-error">{error}</p>}
  </div>;
}
