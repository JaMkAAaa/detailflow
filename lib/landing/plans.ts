import { BILLING_CATALOG } from "@/lib/billing/catalog";
/** Cennik netto PLN, wspólne źródło z Checkout. */
export type LandingPlan = {
  id: "solo" | "studio" | "pro";
  name: string;
  priceNetPln: string;
  annualNetPln: string;
  /** Limit boksów wspólny dla landingu i zapisu boksów; null = bez limitu. */
  maxBays: number | null;
};

export const plans: readonly LandingPlan[] = [
  { id: "solo", name: "Solo", priceNetPln: BILLING_CATALOG.solo.monthly.replace(".00", ""), annualNetPln: BILLING_CATALOG.solo.yearly.replace(".00", ""), maxBays: 1 },
  { id: "studio", name: "Studio", priceNetPln: BILLING_CATALOG.studio.monthly.replace(".00", ""), annualNetPln: BILLING_CATALOG.studio.yearly.replace(".00", ""), maxBays: 4 },
  { id: "pro", name: "Pro", priceNetPln: BILLING_CATALOG.pro.monthly.replace(".00", ""), annualNetPln: BILLING_CATALOG.pro.yearly.replace(".00", ""), maxBays: null },
];

export function planForBays(bays: number): LandingPlan {
  return plans.find((plan) => plan.maxBays === null || bays <= plan.maxBays)!;
}
