import Decimal from "decimal.js";

export type BillingInterval = "monthly" | "yearly";
export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
// PLN netto jako stringi. Decyzja OpenBot z delegacji użytkownika: issue #147.
export const BILLING_CATALOG = {
  solo: { name: "Solo", monthly: "79.00", yearly: "790.00" },
  studio: { name: "Studio", monthly: "149.00", yearly: "1490.00" },
  pro: { name: "Pro", monthly: "279.00", yearly: "2790.00" },
} as const;
export type BillingPlan = keyof typeof BILLING_CATALOG;
export function billingPrice(plan: BillingPlan, interval: BillingInterval = "monthly") {
  const config = BILLING_CATALOG[plan];
  return { name: config.name, lookupKey: `plan_${plan}_${interval}`, net: new Decimal(config[interval]),
    unitAmount: new Decimal(config[interval]).times(100).toNumber(), stripeInterval: interval === "yearly" ? "year" as const : "month" as const };
}
export type BillingSnapshot = {
  plan: BillingPlan;
  billingInterval?: BillingInterval;
  subscriptionNet?: { toString(): string } | string | null;
};
export function periodNet(studio: BillingSnapshot): Decimal {
  return new Decimal(studio.subscriptionNet?.toString() ?? BILLING_CATALOG[studio.plan][studio.billingInterval ?? "monthly"]);
}
export function monthlyNet(studio: BillingSnapshot): Decimal {
  return periodNet(studio).div(studio.billingInterval === "yearly" ? 12 : 1);
}
