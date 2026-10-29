"use client";

import { useState } from "react";

type StudioChoice = { studioId: string; studio: { name: string } };

export function StudioPicker({ choices, studioId }: { choices: StudioChoice[]; studioId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const current = choices.find((choice) => choice.studioId === studioId);

  async function switchStudio(value: string) {
    if (pending || value === studioId) return;
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/studios/active", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studioId: value }),
      });
      if (!response.ok) throw new Error();
      // A full navigation discards prefetched pages and client state of the old tenant.
      window.location.assign("/");
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <section aria-label="Aktywne studio" className="rounded-[18px] bg-df-panel p-4">
      {choices.length > 1 ? (
        <label className="block text-[13px] text-df-muted">
          Wybierz studio
          <select
            value={studioId}
            disabled={pending}
            onChange={(event) => void switchStudio(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg bg-df-raised px-3 text-[15px] text-df-text"
          >
            {choices.map((choice) => <option key={choice.studioId} value={choice.studioId}>{choice.studio.name}</option>)}
          </select>
        </label>
      ) : <p className="text-[15px]">{current?.studio.name}</p>}
      {pending && <p role="status" className="mt-2 text-[13px] text-df-muted">Zmieniam studio…</p>}
      {error && <p role="alert" className="mt-2 text-[13px] text-df-error">Nie udało się zmienić studia. Spróbuj ponownie.</p>}
    </section>
  );
}
