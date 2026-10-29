import Stripe from "stripe";
import { env } from "@/lib/env";
import { AccessError } from "../acl";
import { STRIPE_API_VERSION } from "../billing/stripe";

let client: Stripe | undefined;
export function paymentStripe() {
  const key = env.CLIENT_PAYMENTS_STRIPE_SECRET_KEY;
  // Również przy SKIP_ENV_VALIDATION nie wolno przypadkiem uruchomić live.
  if (!key?.startsWith("sk_test_")) throw new AccessError(409, "Płatności klienta wymagają konfiguracji Stripe Connect sandbox.");
  return client ??= new Stripe(key, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 8000 });
}
