import type Stripe from "stripe";
import type { Plan } from "@/lib/db/generated/client";
import { BILLING_CATALOG, BILLING_INTERVALS, billingPrice, type BillingInterval } from "@/lib/billing/catalog";

// Zachowanie miesięcznego API dla istniejących konsumentów.
export const BILLING_PLANS = Object.fromEntries(Object.keys(BILLING_CATALOG).map(plan => [plan, billingPrice(plan as Plan)])) as Record<Plan, ReturnType<typeof billingPrice>>;
export function priceBilling(price: Stripe.Price) {
  for (const plan of Object.keys(BILLING_CATALOG) as Plan[]) for (const interval of BILLING_INTERVALS) {
    const config = billingPrice(plan, interval);
    if (price.lookup_key === config.lookupKey && price.currency === "pln" && price.unit_amount === config.unitAmount &&
      price.tax_behavior === "exclusive" && price.recurring?.interval === config.stripeInterval && price.recurring.interval_count === 1 && price.recurring.usage_type === "licensed") {
      return { plan, interval, net: config.net };
    }
  }
  throw new Error("Nieprawidłowa cena abonamentu Detailflow.");
}
export function pricePlan(price: Stripe.Price): Plan { return priceBilling(price).plan; }
export async function getPlanPrice(stripe: Stripe, plan: Plan, interval: BillingInterval = "monthly") {
  const prices = await stripe.prices.list({ active: true, lookup_keys: [billingPrice(plan, interval).lookupKey], limit: 2 });
  if (prices.data.length !== 1) throw new Error("Brak jednoznacznej ceny planu w Stripe.");
  const found = priceBilling(prices.data[0]!);
  if (found.plan !== plan || found.interval !== interval) throw new Error("Nieprawidłowy okres ceny Stripe.");
  return prices.data[0]!;
}
