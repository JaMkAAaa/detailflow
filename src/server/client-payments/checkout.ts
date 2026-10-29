import Decimal from "decimal.js";
import type Stripe from "stripe";
import { platformDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { AccessError } from "../acl";
import { lockInvoice, paymentTransaction } from "./lock";
import { studioPaymentAccount } from "./connect";
import { paymentStripe } from "./stripe";

export function stripeGrosze(value: Decimal.Value) {
  const amount = new Decimal(value).times(100);
  if (!amount.isInteger() || amount.lt(200) || amount.gt(99_999_999)) throw new AccessError(409, "Obsługiwany zakres płatności online: 2,00–999 999,99 zł.");
  return amount.toNumber(); // dopiero po kontroli całkowitości i zakresu, bez float * 100
}
export function assertSession(session: Stripe.Checkout.Session, expected: { studioId: string; invoiceId: string; customerId: string; amount: number }) {
  const customer = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (session.livemode || session.mode !== "payment" || session.metadata?.studioId !== expected.studioId || session.metadata?.invoiceId !== expected.invoiceId || session.client_reference_id !== expected.invoiceId || customer !== expected.customerId || session.currency !== "pln" || session.amount_total !== expected.amount || session.amount_subtotal !== expected.amount) {
    throw new AccessError(409, "Niezgodne dane płatności Stripe.");
  }
}

export async function createInvoiceCheckout(studioId: string, invoiceId: string, stripe = paymentStripe()) {
  const account = await studioPaymentAccount(studioId, stripe);
  // Rezerwacja MUSI przetrwać rollback po timeout Stripe lub awarii procesu.
  // Inaczej osierocona zdalna sesja mogłaby konkurować z przelewem ręcznym.
  await paymentTransaction(studioId, async db => {
    const invoice = await lockInvoice(db, invoiceId);
    if (invoice.status !== "issued" || invoice.kind !== "invoice" || invoice.paidAt || !invoice.issuedAt) throw new AccessError(409, "Płatność wymaga wystawionej, nieopłaconej faktury.");
    const order = await db.workOrder.findFirstOrThrow({ where: { id: invoice.workOrderId } });
    if (order.status !== "completed" || !order.completedAt || await db.invoice.count({ where: { correctsInvoiceId: invoiceId, status: { not: "canceled" } } })) throw new AccessError(409, "Dokument wymaga rozliczenia ręcznego.");
    stripeGrosze(invoice.totalGross.toString());
    if (invoice.paymentPending && (!invoice.paymentPendingAt || Date.now() - invoice.paymentPendingAt.getTime() > 23 * 60 * 60_000)) throw new AccessError(409, "Nierozstrzygnięta próba płatności wymaga sprawdzenia w Stripe przez operatora. Nie pobieraj ponownie środków.");
    if (!invoice.paymentPending) await db.invoice.update({ where: { id: invoiceId }, data: { paymentPending: true, paymentPendingAt: new Date(), paymentAttempt: { increment: 1 } } });
  });
  const result = await paymentTransaction(studioId, async db => {
    const invoice = await lockInvoice(db, invoiceId);
    if (invoice.status !== "issued" || invoice.kind !== "invoice" || invoice.paidAt || !invoice.issuedAt) throw new AccessError(409, "Płatność wymaga wystawionej, nieopłaconej faktury.");
    const order = await db.workOrder.findFirstOrThrow({ where: { id: invoice.workOrderId } });
    if (order.status !== "completed" || !order.completedAt) throw new AccessError(409, "Zlecenie nie jest zakończone.");
    // Korekty wymagają indywidualnego rozliczenia, nigdy pobrania starej kwoty FV.
    if (await db.invoice.count({ where: { correctsInvoiceId: invoiceId, status: { not: "canceled" } } })) throw new AccessError(409, "Faktura z korektą wymaga rozliczenia ręcznego.");
    const amount = stripeGrosze(invoice.totalGross.toString());
    const metadata = { studioId, invoiceId };
    let customerId = invoice.paymentCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ metadata }, { stripeAccount: account, idempotencyKey: `invoice-customer-${invoiceId}` });
      customerId = customer.id;
      await db.invoice.update({ where: { id: invoiceId }, data: { paymentCustomerId: customerId } });
    }
    if (invoice.paymentSessionId) {
      const session = await stripe.checkout.sessions.retrieve(invoice.paymentSessionId, {}, { stripeAccount: account });
      assertSession(session, { studioId, invoiceId, customerId, amount });
      if (session.status === "open") {
        await db.invoice.update({ where: { id: invoiceId }, data: { paymentPending: false } });
        return { url: session.url };
      }
      if (session.status !== "expired" || session.payment_status !== "unpaid") throw new AccessError(409, "Płatność oczekuje na potwierdzenie webhookiem.");
    }
    const attempt = invoice.paymentAttempt;
    const session = await stripe.checkout.sessions.create({
      mode: "payment", customer: customerId, client_reference_id: invoiceId, metadata,
      allowed_payment_method_types: ["card"], // bez opóźnionych metod i wyścigu z płatnością ręczną
      line_items: [{ quantity: 1, price_data: { currency: "pln", unit_amount: amount, product_data: { name: `Faktura ${invoice.number}` } } }],
      payment_intent_data: { metadata }, // brak application_fee_amount, transfer_data, on_behalf_of
      success_url: `${env.APP_URL}/payment-result?result=success`, cancel_url: `${env.APP_URL}/payment-result?result=cancel`,
    }, { stripeAccount: account, idempotencyKey: `invoice-checkout-${invoiceId}-${attempt}` });
    assertSession(session, { studioId, invoiceId, customerId, amount });
    await db.invoice.update({ where: { id: invoiceId }, data: { paymentSessionId: session.id, paymentPending: false } });
    return { url: session.status === "open" ? session.url : null };
  });
  if (!result.url) throw new AccessError(409, "Sesja wygasła. Utwórz ponownie link płatności.");
  return result;
}

export async function expireInvoiceCheckout(studioId: string, invoiceId: string, stripe = paymentStripe()) {
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId } });
  const account = studio.clientPaymentAccountId;
  if (!account) throw new AccessError(409, "Brak konta płatności studia.");
  return paymentTransaction(studioId, async db => {
    const invoice = await lockInvoice(db, invoiceId);
    if (invoice.paymentPending) throw new AccessError(409, "Najpierw ponów utworzenie linku, aby odzyskać stan Stripe.");
    if (!invoice.paymentSessionId) return { expired: true };
    let session = await stripe.checkout.sessions.retrieve(invoice.paymentSessionId, {}, { stripeAccount: account });
    if (session.status === "open") session = await stripe.checkout.sessions.expire(session.id, {}, { stripeAccount: account });
    if (session.status !== "expired" || session.payment_status !== "unpaid") throw new AccessError(409, "Płatność zakończona lub w toku. Poczekaj na webhook.");
    return { expired: true };
  });
}
