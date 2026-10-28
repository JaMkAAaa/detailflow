import Stripe from "stripe";
import { env } from "@/lib/env";
import { AccessError } from "../acl";

// Wersja wspólna dla SDK i snapshot webhook endpointu w Stripe Workbench.
export const STRIPE_API_VERSION = "2026-09-30.endive" as const;
let client: Stripe | undefined;
export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) throw new AccessError(409, "Płatności Stripe nie są skonfigurowane.");
  const port = env.STRIPE_API_PORT ? Number(env.STRIPE_API_PORT) : undefined;
  return client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 8000,
    ...(env.STRIPE_API_HOST
      ? {
          host: env.STRIPE_API_HOST,
          protocol: env.STRIPE_API_PROTOCOL ?? "https",
          telemetry: false,
          ...(port ? { port } : {}),
        }
      : {}),
  });
}
