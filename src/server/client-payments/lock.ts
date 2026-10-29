import { studioDb, type StudioDb } from "@/lib/db/tenant";
import { AccessError } from "../acl";
import { platformDb } from "@/lib/db/client";

/** Pierwszy UPDATE blokuje wiersz do końca transakcji także dla manual/correction. */
export async function lockInvoice(db: StudioDb, invoiceId: string) {
  const claim = await db.invoice.updateMany({ where: { id: invoiceId }, data: { paymentLock: { increment: 1 } } });
  if (!claim.count) throw new AccessError(404, "Nie znaleziono faktury.");
  return db.invoice.findFirstOrThrow({ where: { id: invoiceId } });
}
export async function paymentTransaction<T>(studioId: string, run: (db: StudioDb) => Promise<T>) {
  return studioDb(studioId).$transaction(tx => run(tx as unknown as StudioDb), { timeout: 60000 });
}

/** Nie wolno ręcznie rozliczyć/zmienić dokumentu, dopóki Stripe może pobrać środki. */
export async function requireNoOnlinePayment(db: StudioDb, studioId: string, invoiceId: string) {
  const invoice = await lockInvoice(db, invoiceId);
  // Potwierdzona wpłata nie blokuje późniejszej korekty księgowej.
  if (invoice.paidAt && invoice.paymentIntentId) return invoice;
  if (invoice.paymentPending) throw new AccessError(409, "Tworzenie płatności online wymaga ponowienia. Odzyskaj link przed rozliczeniem ręcznym.");
  if (invoice.paymentSessionId) {
    const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId } });
    if (!studio.clientPaymentAccountId) throw new AccessError(409, "Brak powiązania konta płatności.");
    // Zwykłe faktury/manual nie wymagają konfiguracji opcjonalnej integracji.
    const { paymentStripe } = await import("./stripe");
    const session = await paymentStripe().checkout.sessions.retrieve(invoice.paymentSessionId, {}, { stripeAccount: studio.clientPaymentAccountId });
    if (session.status !== "expired" || session.payment_status !== "unpaid") throw new AccessError(409, "Aktywna lub zakończona płatność online. Anuluj otwartą sesję albo poczekaj na webhook Stripe.");
  }
  return invoice;
}
