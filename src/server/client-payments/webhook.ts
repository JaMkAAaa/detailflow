import type Stripe from "stripe";
import { platformDb } from "@/lib/db/client";
import { lockInvoice, paymentTransaction } from "./lock";
import { assertSession, stripeGrosze } from "./checkout";
import { paymentStripe } from "./stripe";

export async function processClientPaymentEvent(event: Stripe.Event, stripe = paymentStripe()) {
  // Inny obieg niż Billing. Tylko snapshot events z kont połączonych, tylko sandbox.
  if (event.livemode || !event.account || !["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return;
  const payload = event.data.object as Stripe.Checkout.Session;
  if (payload.mode !== "payment") return;
  const { studioId, invoiceId } = payload.metadata ?? {};
  if (!studioId || !invoiceId) return;
  const studio = await platformDb.studio.findUnique({ where: { id: studioId } });
  if (!studio?.clientPaymentAccountId || event.account !== studio.clientPaymentAccountId) throw new Error("Niezgodne konto odbiorcy.");
  await paymentTransaction(studioId, async db => {
    const invoice = await lockInvoice(db, invoiceId);
    if (await db.clientPaymentEvent.findFirst({ where: { id: event.id } })) return;
    if (!invoice.paymentCustomerId || invoice.paymentSessionId !== payload.id) throw new Error("Niezgodna sesja faktury.");
    const session = await stripe.checkout.sessions.retrieve(payload.id, {}, { stripeAccount: event.account });
    const expected = { studioId, invoiceId, customerId: invoice.paymentCustomerId, amount: stripeGrosze(invoice.totalGross.toString()) };
    assertSession(payload, expected);
    assertSession(session, expected);
    if (session.status !== "complete" || session.payment_status !== "paid") return;
    if (!invoice.paidAt && (invoice.kind !== "invoice" || invoice.status !== "issued" || !invoice.issuedAt || await db.invoice.count({ where: { correctsInvoiceId: invoiceId, status: { not: "canceled" } } }))) throw new Error("Faktura nie kwalifikuje się do płatności.");
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!intentId) throw new Error("Brak PaymentIntent.");
    const intent = await stripe.paymentIntents.retrieve(intentId, {}, { stripeAccount: event.account });
    const customer = typeof intent.customer === "string" ? intent.customer : intent.customer?.id;
    if (intent.livemode || intent.status !== "succeeded" || intent.amount !== expected.amount || intent.amount_received !== expected.amount || intent.currency !== "pln" || customer !== expected.customerId || intent.metadata.studioId !== studioId || intent.metadata.invoiceId !== invoiceId || intent.application_fee_amount || intent.transfer_data || intent.on_behalf_of) throw new Error("Niezgodny direct charge.");
    if (invoice.paidAt && invoice.paymentIntentId !== intentId) throw new Error("Faktura rozliczona inną płatnością.");
    // Powtórzenie z innym event.id nie zmienia pierwotnego paidAt.
    if (!invoice.paidAt) await db.invoice.update({ where: { id: invoiceId }, data: { paidAt: new Date(), paymentIntentId: intentId, paymentPending: false } });
    await db.clientPaymentEvent.create({ data: { id: event.id, studioId, invoiceId } });
  });
}
