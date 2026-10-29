import { platformDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { AccessError, authorizeStudio } from "../acl";
import { portalConfiguration } from "./portal-configuration";
import { getStripe } from "./stripe";

export async function createBillingPortal(userId: string, studioId: string, stripe = getStripe()) {
  await authorizeStudio(userId, studioId, "billing:manage");
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId }, select: { stripeCustomerId: true } });
  if (!studio.stripeCustomerId) throw new AccessError(409, "Studio nie ma jeszcze konta rozliczeniowego Stripe. Wybierz abonament po zakończeniu trialu.");
  const configuration = await portalConfiguration(stripe);
  const session = await stripe.billingPortal.sessions.create({
    customer: studio.stripeCustomerId,
    configuration: configuration.id,
    return_url: new URL("/billing", env.APP_URL).href,
    locale: "pl",
  });
  return { url: session.url };
}
