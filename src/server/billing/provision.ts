import { BILLING_PLANS, getPlanPrice } from "./plans";
import { getStripe } from "./stripe";

// Jawna komenda administracyjna; Checkout nigdy nie tworzy produktów ani cen.
async function main() {
  const stripe = getStripe();
  for (const [plan, config] of Object.entries(BILLING_PLANS)) {
    const existing = await stripe.prices.list({ lookup_keys: [config.lookupKey], limit: 1 });
    if (!existing.data.length) {
      const product = await stripe.products.create({ name: `Detailflow ${config.name}`, metadata: { plan } }, { idempotencyKey: `detailflow:product:${plan}:v1` });
      await stripe.prices.create({
        product: product.id, lookup_key: config.lookupKey, currency: "pln", unit_amount: config.unitAmount,
        tax_behavior: "exclusive", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
      }, { idempotencyKey: `detailflow:price:${plan}:monthly:v1` });
    }
    await getPlanPrice(stripe, plan as keyof typeof BILLING_PLANS);
    console.info(`${config.lookupKey}: OK`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Nie udało się skonfigurować Stripe.");
  process.exitCode = 1;
});
