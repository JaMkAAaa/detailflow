import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { BILLING_CATALOG, BILLING_INTERVALS } from "@/lib/billing/catalog";
import { getPlanPrice } from "./plans";

/** Jawna konfiguracja zamiast zależnej od ustawień domyślnego portalu. */
export async function portalConfiguration(stripe: Stripe) {
  const products = new Map<string, string[]>();
  for (const plan of Object.keys(BILLING_CATALOG) as (keyof typeof BILLING_CATALOG)[]) {
    for (const interval of BILLING_INTERVALS) {
      const price = await getPlanPrice(stripe, plan, interval);
      const product = typeof price.product === "string" ? price.product : price.product.id;
      products.set(product, [...(products.get(product) ?? []), price.id]);
    }
  }
  const params: Stripe.BillingPortal.ConfigurationCreateParams = {
    business_profile: { headline: "Abonament Detailflow" },
    features: {
      invoice_history: { enabled: true }, payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      subscription_update: {
        enabled: true, default_allowed_updates: ["price"],
        products: [...products].map(([product, prices]) => ({ product, prices })),
        proration_behavior: "always_invoice", billing_cycle_anchor: "now",
        // Żadnego odroczenia obniżenia planu ani skrócenia okresu.
        schedule_at_period_end: { conditions: [] },
      },
    },
  };
  const hash = createHash("sha256").update(JSON.stringify(params)).digest("hex");
  // Ten sam katalog/polityka: ponowienia i równoległe żądania używają tego samego klucza.
  return stripe.billingPortal.configurations.create(params, { idempotencyKey: `detailflow:portal:${hash}` });
}
