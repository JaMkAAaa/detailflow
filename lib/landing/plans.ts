/** Cennik miesięczny netto (docs §1). Kwoty jako stringi PLN — bez float. Roczny poza v1. */
export type LandingPlan = {
  id: "solo" | "studio" | "pro";
  name: string;
  priceNetPln: string;
  /** Limit boksów z makiety L-01; null = bez limitu. Do zatwierdzenia (docs: otwarte pytanie o limity). */
  maxBays: number | null;
};

export const plans: readonly LandingPlan[] = [
  { id: "solo", name: "Solo", priceNetPln: "79", maxBays: 1 },
  { id: "studio", name: "Studio", priceNetPln: "149", maxBays: 4 },
  { id: "pro", name: "Pro", priceNetPln: "279", maxBays: null },
];

export function planForBays(bays: number): LandingPlan {
  return plans.find((plan) => plan.maxBays === null || bays <= plan.maxBays)!;
}
