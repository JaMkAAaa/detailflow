import type Stripe from "stripe";
import { platformDb } from "@/lib/db/client";
import type { StudioStatus } from "@/lib/db/generated/client";
import { pricePlan } from "./plans";
import { endedSubscription } from "./checkout";
import { getStripe } from "./stripe";

export const BILLING_EVENTS = new Set([
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "customer.subscription.paused", "customer.subscription.resumed",
  "customer.subscription.pending_update_applied", "customer.subscription.pending_update_expired",
  "customer.subscription.trial_will_end", "invoice.paid", "invoice.payment_failed",
]);

function objectId(value: string | { id: string } | null | undefined) { return typeof value === "string" ? value : value?.id; }
export function subscriptionStatus(status: Stripe.Subscription.Status): StudioStatus {
  switch (status) {
    case "active": return "active";
    case "trialing": return "trial";
    case "past_due": return "past_due";
    case "canceled": case "incomplete_expired": return "canceled";
    case "unpaid": case "paused": case "incomplete": return "suspended";
    default: throw new Error("Nieznany status abonamentu Stripe.");
  }
}

/** Atomowo zapisuje event i kopię stanu. Błąd = rollback obu; Stripe może ponowić dostarczenie. */
export async function processStripeEvent(event: Stripe.Event, stripe = getStripe()) {
  if (!BILLING_EVENTS.has(event.type)) return;
  if (await platformDb.stripeEvent.findUnique({ where: { id: event.id } })) return;
  let subscriptionId: string | undefined;
  let invoice: Stripe.Invoice | undefined;
  let session: Stripe.Checkout.Session | undefined;
  if (event.type === "checkout.session.completed") {
    session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription") return;
    subscriptionId = objectId(session.subscription);
  } else if (event.type.startsWith("customer.subscription.")) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  } else {
    invoice = event.data.object as Stripe.Invoice;
    subscriptionId = objectId(invoice.parent?.subscription_details?.subscription);
  }
  // Faktury jednorazowe nie są abonamentem Detailflow.
  if (!subscriptionId) return;
  const initial = await stripe.subscriptions.retrieve(subscriptionId);
  const studioId = initial.metadata.studioId;
  if (!studioId) return; // obca integracja w tym samym koncie Stripe
  await platformDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${studioId}, 50))::text`;
    const claim = await tx.stripeEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
    if (claim.count === 0) return;
    const studio = await tx.studio.findUnique({ where: { id: studioId } });
    // Customer zapisany przez uwierzytelniony Checkout jest wiążącym powiązaniem tenanta.
    if (!studio || !studio.stripeCustomerId || studio.stripeCustomerId !== objectId(initial.customer)) throw new Error("Niezgodne powiązanie Stripe ze studiem.");
    if (session && (session.client_reference_id !== studioId || session.metadata?.studioId !== studioId || objectId(session.customer) !== studio.stripeCustomerId)) throw new Error("Niezgodny tenant sesji Checkout.");
    if (invoice && objectId(invoice.customer) !== studio.stripeCustomerId) throw new Error("Niezgodny tenant faktury Stripe.");
    if (studio.stripeSubscriptionId && studio.stripeSubscriptionId !== subscriptionId) {
      const previous = await stripe.subscriptions.retrieve(studio.stripeSubscriptionId);
      // Stripe zapisuje created z dokładnością do sekundy; nowy abonament może
      // powstać w tej samej sekundzie, w której zakończył się poprzedni.
      if (initial.created < previous.created || (endedSubscription(initial.status) && !endedSubscription(previous.status))) return;
      if (!endedSubscription(previous.status)) throw new Error("Studio ma inny aktywny abonament.");
    }
    // Ponowny odczyt pod lockiem: stare payloady i równoległe webhooki nie cofają stanu.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId!);
    if (objectId(subscription.customer) !== studio.stripeCustomerId || subscription.metadata.studioId !== studioId) throw new Error("Niezgodny tenant abonamentu.");
    if (subscription.items.data.length !== 1 || subscription.items.data[0]?.quantity !== 1) throw new Error("Nieprawidłowe pozycje abonamentu.");
    const plan = pricePlan(subscription.items.data[0].price);
    let status = subscriptionStatus(subscription.status);
    if (invoice && objectId(subscription.latest_invoice) === invoice.id && !endedSubscription(subscription.status) && subscription.status !== "paused" && subscription.status !== "unpaid") {
      const currentInvoice = await stripe.invoices.retrieve(invoice.id);
      if (event.type === "invoice.payment_failed" && currentInvoice.status === "open") status = "past_due";
    }
    await tx.studio.update({
      where: { id: studioId },
      data: {
        plan,
        status,
        stripeSubscriptionId: subscription.id,
        ...(status === "active" && !studio.activatedAt ? { activatedAt: new Date() } : {}),
      },
    });
    await tx.auditLog.create({ data: { studioId, action: event.type, meta: {
      eventId: event.id, subscriptionId: subscription.id, plan, status,
      ...(invoice ? { invoiceId: invoice.id, currency: invoice.currency, amountPaid: String(invoice.amount_paid) } : {}),
    } } });
  }, { timeout: 60000 });
}
