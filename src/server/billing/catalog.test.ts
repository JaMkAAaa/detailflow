import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { billingPrice } from "@/lib/billing/catalog";
import { provisionBilling } from "./provisioning";
import { priceBilling, getPlanPrice } from "./plans";

const cases = [
  ["solo", "monthly", 7900], ["studio", "monthly", 14900], ["pro", "monthly", 27900],
  ["solo", "yearly", 79000], ["studio", "yearly", 149000], ["pro", "yearly", 279000],
] as const;
function price(plan: typeof cases[number][0], interval: typeof cases[number][1], amount: number): Stripe.Price {
  return { id: `price_${plan}_${interval}`, product: `prod_${plan}`, lookup_key: `plan_${plan}_${interval}`,
    currency: "pln", unit_amount: amount, active: true, tax_behavior: "exclusive",
    recurring: { interval: interval === "yearly" ? "year" : "month", interval_count: 1, usage_type: "licensed" } } as Stripe.Price;
}
describe("approved monthly and annual Stripe catalog", () => {
  it.each(cases)("validates %s %s at %i grosze and rejects altered contracts", (plan, interval, amount) => {
    const good = price(plan, interval, amount);
    expect(billingPrice(plan, interval).unitAmount).toBe(amount);
    expect(priceBilling(good)).toMatchObject({ plan, interval });
    for (const bad of [
      { unit_amount: amount + 1 }, { currency: "eur" }, { tax_behavior: "inclusive" },
      { lookup_key: "custom" }, { recurring: { ...good.recurring, interval_count: 2 } },
      { recurring: { ...good.recurring, usage_type: "metered" } },
      { recurring: { ...good.recurring, interval: interval === "yearly" ? "month" : "year" } },
    ]) expect(() => priceBilling({ ...good, ...bad } as Stripe.Price)).toThrow();
  });
  it("provisions six prices once and shares monthly/yearly products; rejects existing wrong amounts", async () => {
    const stored: Stripe.Price[] = [];
    const products = { create: vi.fn().mockImplementation(async ({ metadata }) => ({ id: `prod_${metadata.plan}` })) };
    const prices = {
      list: vi.fn().mockImplementation(async ({ lookup_keys, active }) => ({ data: stored.filter(p => lookup_keys.includes(p.lookup_key) && (!active || p.active)) })),
      create: vi.fn().mockImplementation(async params => { const p = { ...params, id: `price_${stored.length}`, active: true }; stored.push(p); return p; }),
    };
    const stripe = { products, prices } as unknown as Stripe;
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      await provisionBilling(stripe); await provisionBilling(stripe);
      expect(products.create).toHaveBeenCalledTimes(3);
      expect(prices.create).toHaveBeenCalledTimes(6);
      for (const [plan, interval, amount] of cases) {
        const p = await getPlanPrice(stripe, plan, interval);
        expect(p.product).toBe(`prod_${plan}`); expect(p.unit_amount).toBe(amount);
      }
      stored[0]!.unit_amount = 1;
      await expect(provisionBilling(stripe)).rejects.toThrow();
      expect(prices.create).toHaveBeenCalledTimes(6);
    } finally { log.mockRestore(); }
  });
  it("fails closed on missing or ambiguous lookup keys", async () => {
    const p = price("solo", "yearly", 79000);
    for (const data of [[], [p, p]]) {
      const stripe = { prices: { list: vi.fn().mockResolvedValue({ data }) } } as unknown as Stripe;
      await expect(getPlanPrice(stripe, "solo", "yearly")).rejects.toThrow();
    }
  });
});
