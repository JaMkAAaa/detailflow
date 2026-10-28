"use server";

import { revalidatePath } from "next/cache";
import { platformDb } from "@/lib/db/client";
import { requirePlatform } from "@/src/server/admin/context";
import { assertActionOrigin } from "@/src/server/action-origin";
import { COST_CATEGORIES, parseCostAmount } from "@/src/server/admin/costs";
import { warsawParts } from "@/src/server/admin/metrics";

export type CostFormState = { message: string };

export async function savePlatformCosts(_prev: CostFormState, form: FormData): Promise<CostFormState> {
  await assertActionOrigin();
  const { role } = await requirePlatform();
  if (role === "support") return { message: "Rola wsparcia nie zmienia kosztów." };
  const amounts: { category: (typeof COST_CATEGORIES)[number]; amount: string }[] = [];
  for (const category of COST_CATEGORIES) {
    const amount = parseCostAmount(form.get(category));
    if (amount === null) return { message: "Podaj kwoty netto w PLN, maksymalnie dwa miejsca po przecinku." };
    amounts.push({ category, amount });
  }
  const { year, month } = warsawParts(new Date());
  await platformDb.$transaction(amounts.map((row) => platformDb.platformCost.upsert({
    where: { year_month_category: { year, month, category: row.category } },
    create: { year, month, category: row.category, amountNet: row.amount },
    update: { amountNet: row.amount },
  })));
  revalidatePath("/admin/subscriptions");
  return { message: "Zapisano koszty tego miesiąca." };
}
