import { BILLING_CATALOG, BILLING_INTERVALS, billingPrice } from "@/lib/billing/catalog";
import { getPlanPrice } from "./plans";
import type Stripe from "stripe";

// Jawna komenda administracyjna; Checkout nigdy nie tworzy produktów ani cen.
export async function provisionBilling(stripe: Stripe) {
  for (const plan of Object.keys(BILLING_CATALOG) as (keyof typeof BILLING_CATALOG)[]) {
    let productId: string | undefined;
    for (const interval of BILLING_INTERVALS) {
      const config = billingPrice(plan, interval);
      const existing = await stripe.prices.list({ lookup_keys: [config.lookupKey], limit: 2 });
      if (!existing.data.length) {
        if (!productId) {
          const product = await stripe.products.create({ name: `Detailflow ${config.name}`, metadata: { plan } }, { idempotencyKey: `detailflow:product:${plan}:v1` });
          productId = product.id;
        }
        await stripe.prices.create({
          product: productId, lookup_key: config.lookupKey, currency: "pln", unit_amount: config.unitAmount,
          tax_behavior: "exclusive", recurring: { interval: config.stripeInterval, interval_count: 1, usage_type: "licensed" },
        }, { idempotencyKey: `detailflow:price:${plan}:${interval}:v1` });
      }
      const verified = await getPlanPrice(stripe, plan, interval);
      productId = typeof verified.product === "string" ? verified.product : verified.product.id;
      console.info(`${config.lookupKey}: OK`);
    }
  }
}
