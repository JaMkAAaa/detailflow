"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { setKsefEnvAction } from "@/app/(studio)/invoices/actions";
import { KsefEnvBadge } from "@/components/ksef/KsefEnvBadge";

const tokenWarning = "Zmiana środowiska usuwa zapisany token. Trzeba wprowadzić go ponownie. Token TEST nie działa na PROD.";

export function KsefEnvForm({
  env,
  prodAllowed,
  tokenSet,
}: {
  env: "test" | "production";
  prodAllowed: boolean;
  tokenSet: boolean;
}) {
  const titleId = useId();
  const [confirmEnv, setConfirmEnv] = useState<"test" | "production" | null>(null);
  const [state, action, pending] = useActionState(setKsefEnvAction, { error: "" });
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setConfirmEnv(null);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-df-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <KsefEnvBadge env={env} />
        <button type="button" onClick={() => setConfirmEnv("test")} disabled={pending || env === "test"} className="min-h-10 rounded-lg bg-df-raised px-3 text-df-label disabled:opacity-40">
          Środowisko TEST
        </button>
        <button type="button" onClick={() => setConfirmEnv("production")} disabled={pending || env === "production" || !prodAllowed} className="min-h-10 rounded-lg bg-df-raised px-3 text-df-label disabled:opacity-40">
          Środowisko PROD
        </button>
      </div>
      {!prodAllowed && env === "test" && <p className="text-df-label text-df-muted">KSeF PROD jest wyłączony na platformie. To studio zostaje na TEST.</p>}
      {!prodAllowed && env === "production" && <p className="text-df-label text-df-amber">Flaga PROD jest wyłączona. Wróć na TEST — wysyłka produkcyjna nie ruszy.</p>}
      {prodAllowed && tokenSet && <p className="text-df-label text-df-muted">{tokenWarning}</p>}
      {confirmEnv && (
        <div role="dialog" aria-labelledby={titleId} className="flex flex-col gap-3 rounded-lg bg-df-raised p-3">
          <h2 id={titleId} className="text-df-strong">Zmiana środowiska KSeF</h2>
          <p className="text-df-label text-df-muted">{tokenWarning}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmEnv(null)} className="min-h-10 rounded-lg bg-df-panel px-3 text-df-label">Anuluj</button>
            <button type="submit" name="env" value={confirmEnv} disabled={pending} className="min-h-10 rounded-lg bg-df-lime px-3 text-df-bg disabled:opacity-40">
              Potwierdź zmianę
            </button>
          </div>
        </div>
      )}
      {state.error && <p role="alert" className="text-df-label text-df-error">{state.error}</p>}
    </form>
  );
}
