"use client";

import { useState, type FormEvent } from "react";

export function TokenForm({ studioId, tokenSet }: { studioId: string; tokenSet: boolean }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const token = String(new FormData(form).get("token") ?? "");
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/studios/${studioId}/ksef/token`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (response.status === 204) {
        form.reset();
        setMessage("Token KSeF został zapisany.");
        return;
      }
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      setError(typeof payload?.error === "string" ? payload.error : "Nie udało się zapisać tokenu KSeF.");
    } catch {
      setError("Nie udało się zapisać tokenu KSeF.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-3 rounded-xl bg-df-panel p-4">
      <h2 className="text-df-strong">Token KSeF</h2>
      <p className="text-df-label text-df-muted">{tokenSet ? "Token jest zapisany. Nowa wartość go zastąpi." : "Brak zapisanego tokenu."}</p>
      <label className="flex flex-col gap-2 text-df-label">
        Token
        <input name="token" type="password" autoComplete="off" required maxLength={4096} spellCheck={false} className="block w-full rounded bg-df-raised p-3 text-df-body" />
      </label>
      <button disabled={pending} className="min-h-10 rounded-lg bg-df-lime px-3 text-df-bg disabled:opacity-40">{pending ? "Zapisywanie…" : "Zapisz token"}</button>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert" className="text-df-error">{error}</p>}
    </form>
  );
}
