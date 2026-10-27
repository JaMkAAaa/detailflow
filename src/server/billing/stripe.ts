import Stripe from "stripe";
import { env } from "@/lib/env";
import { AccessError } from "../acl";

// Wersja wspólna dla SDK i snapshot webhook endpointu w Stripe Workbench.
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
let client: Stripe | undefined;
export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new AccessError(409, "Płatności Stripe nie są skonfigurowane.");
  return client ??= new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 8000 });
}
