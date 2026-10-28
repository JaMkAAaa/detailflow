"use client";

import { useActionState } from "react";
import { setKsefEnvAction } from "@/app/(studio)/invoices/actions";
import { KsefEnvBadge } from "@/components/ksef/KsefEnvBadge";

export function KsefEnvForm({
  env,
  prodAllowed,
  tokenSet,
}: {
  env: "test" | "production";
  prodAllowed: boolean;
  tokenSet: boolean;
}) {
  const [state, action, pending] = useActionState(setKsefEnvAction, { error: "" });
  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl bg-df-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <KsefEnvBadge env={env} />
        <button type="submit" name="env" value="test" disabled={pending || env === "test"} className="min-h-10 rounded-lg bg-df-raised px-3 text-df-label disabled:opacity-40">
          Środowisko TEST
        </button>
        <button type="submit" name="env" value="production" disabled={pending || env === "production" || !prodAllowed} className="min-h-10 rounded-lg bg-df-raised px-3 text-df-label disabled:opacity-40">
          Środowisko PROD
        </button>
      </div>
      {!prodAllowed && env === "test" && <p className="text-df-label text-df-muted">KSeF PROD jest wyłączony na platformie. To studio zostaje na TEST.</p>}
      {!prodAllowed && env === "production" && <p className="text-df-label text-df-amber">Flaga PROD jest wyłączona. Wróć na TEST — wysyłka produkcyjna nie ruszy.</p>}
      {prodAllowed && tokenSet && <p className="text-df-label text-df-muted">Zmiana środowiska usuwa zapisany token. Trzeba wprowadzić go ponownie. Token TEST nie działa na PROD.</p>}
      {state.error && <p role="alert" className="text-df-label text-df-error">{state.error}</p>}
    </form>
  );
}
