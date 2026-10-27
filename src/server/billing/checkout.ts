import type Stripe from "stripe";
import { z } from "zod";
import { platformDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { AccessError, authorizeStudio } from "../acl";
import { getPlanPrice } from "./plans";
import { getStripe } from "./stripe";

export const checkoutInput = z.object({ plan: z.enum(["solo", "studio", "pro"]) });
export const endedSubscription = (status: Stripe.Subscription.Status) => status === "canceled" || status === "incomplete_expired";

export async function createCheckout(userId: string, studioId: string, input: unknown, stripe = getStripe()) {
  await authorizeStudio(userId, studioId, "billing:manage");
  const { plan } = checkoutInput.parse(input);
  return platformDb.$transaction(async tx => {
    // Wspólny lock Checkout/webhook: brak podwójnego customer/subscription przy równoległych żądaniach.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${studioId}, 50))::text`;
    const studio = await tx.studio.findUniqueOrThrow({ where: { id: studioId } });
    if (studio.status === "suspended") throw new AccessError(409, "Konto jest wstrzymane. Skontaktuj się ze wsparciem.");
    if (studio.status === "trial" && studio.trialEndsAt && studio.trialEndsAt > new Date()) {
      throw new AccessError(409, "Okres próbny jeszcze trwa. Karta nie jest wymagana.");
    }
    const price = await getPlanPrice(stripe, plan);
    let customerId = studio.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ name: studio.name, metadata: { studioId } }, { idempotencyKey: `detailflow:customer:${studioId}` });
      customerId = customer.id;
      await tx.studio.update({ where: { id: studioId }, data: { stripeCustomerId: customerId } });
    }
    // Sprawdzamy Stripe również przed dotarciem webhooku pierwszego Checkout.
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.data.some(sub => !endedSubscription(sub.status))) throw new AccessError(409, "Studio ma już abonament. Zarządzaj nim w portalu Stripe.");
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
    for (const session of sessions.data) {
      if (session.mode !== "subscription" || session.metadata?.studioId !== studioId) continue;
      if (session.metadata.plan === plan && session.url) return { url: session.url };
      await stripe.checkout.sessions.expire(session.id);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription", customer: customerId, client_reference_id: studioId,
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { studioId, plan }, subscription_data: { metadata: { studioId } },
      automatic_tax: { enabled: true }, tax_id_collection: { enabled: true },
      customer_update: { name: "auto", address: "auto" }, billing_address_collection: "required",
      success_url: new URL("/billing?checkout=success", env.APP_URL).href,
      cancel_url: new URL("/billing?checkout=canceled", env.APP_URL).href,
      locale: "pl",
    });
    if (!session.url) throw new Error("Stripe nie zwrócił URL Checkout.");
    return { url: session.url };
  }, { timeout: 60000 });
}
