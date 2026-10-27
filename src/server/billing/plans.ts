import type Stripe from "stripe";
import type { Plan } from "@/lib/db/generated/client";

// Kwoty w groszach, netto. Podatek wylicza Stripe Tax, bez arytmetyki float.
export const BILLING_PLANS = {
  solo: { name: "Solo", lookupKey: "plan_solo_monthly", unitAmount: 7900 },
  studio: { name: "Studio", lookupKey: "plan_studio_monthly", unitAmount: 14900 },
  pro: { name: "Pro", lookupKey: "plan_pro_monthly", unitAmount: 27900 },
} as const satisfies Record<Plan, { name: string; lookupKey: string; unitAmount: number }>;

export function pricePlan(price: Stripe.Price): Plan {
  const plan = (Object.keys(BILLING_PLANS) as Plan[]).find(key => BILLING_PLANS[key].lookupKey === price.lookup_key);
  if (!plan || price.currency !== "pln" || price.unit_amount !== BILLING_PLANS[plan].unitAmount ||
    price.tax_behavior !== "exclusive" || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") {
    throw new Error("Nieprawidłowa cena abonamentu Detailflow.");
  }
  return plan;
}

export async function getPlanPrice(stripe: Stripe, plan: Plan) {
  const prices = await stripe.prices.list({ active: true, lookup_keys: [BILLING_PLANS[plan].lookupKey], limit: 2 });
  if (prices.data.length !== 1 || pricePlan(prices.data[0]!) !== plan) throw new Error("Brak jednoznacznej ceny planu w Stripe.");
  return prices.data[0]!;
}
