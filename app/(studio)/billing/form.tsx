"use client";
import { useState } from "react";

export function CheckoutForm({ studioId }: { studioId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <form className="flex flex-col gap-4" onSubmit={async event => {
    event.preventDefault();
    const plan = new FormData(event.currentTarget).get("plan");
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/studios/${studioId}/billing/checkout`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Nie udało się otworzyć Checkout.");
      window.location.assign(result.url);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Nie udało się otworzyć Checkout.");
      setPending(false);
    }
  }}>
    <label htmlFor="billing-plan">Plan miesięczny (netto)</label>
    <select id="billing-plan" name="plan" disabled={pending} className="rounded-lg bg-df-raised p-3">
      <option value="solo">Solo — 79 zł / mies.</option>
      <option value="studio">Studio — 149 zł / mies.</option>
      <option value="pro">Pro — 279 zł / mies.</option>
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
