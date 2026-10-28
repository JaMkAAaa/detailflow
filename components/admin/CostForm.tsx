"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { COST_LABEL } from "@/src/server/admin/costs";
import { savePlatformCosts, type CostFormState } from "@/app/(platform)/admin/(console)/subscriptions/actions";

const initial: CostFormState = { message: "" };

function fieldValue(amount: string) {
  const [whole, fraction = "00"] = amount.split(".");
  if (!fraction || fraction === "00") return whole ?? "0";
  return `${whole},${fraction}`;
}

export function CostForm({
  monthLabel,
  costs,
  canEdit,
}: {
  monthLabel: string;
  costs: { category: keyof typeof COST_LABEL; amount: string }[];
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(savePlatformCosts, initial);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
      {costs.map((cost) => (
        <label key={cost.category} className="block text-df-label text-df-muted">
          {COST_LABEL[cost.category]}
          <input
            name={cost.category}
            inputMode="decimal"
            defaultValue={fieldValue(cost.amount)}
            disabled={!canEdit || pending}
            aria-label={COST_LABEL[cost.category]}
            className="mt-1 h-10 w-full rounded-lg bg-df-raised px-3 text-df-body text-df-text disabled:opacity-60"
          />
        </label>
      ))}
      {canEdit ? (
        <Button type="submit" variant="secondary" loading={pending} loadingLabel="Zapisywanie…">
          Zapisz
        </Button>
      ) : (
        <p className="text-df-label text-df-muted">Podgląd. Koszty zmienia właściciel lub administrator.</p>
      )}
      <p className="text-df-label text-df-muted sm:col-span-4" role="status">
        {state.message || `Koszty za ${monthLabel}. Puste pole zapisuje 0.`}
      </p>
    </form>
  );
}
