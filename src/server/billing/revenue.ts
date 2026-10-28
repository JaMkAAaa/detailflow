import Decimal from "decimal.js";

/** Netto PLN z opłaconej faktury Stripe. `amount_paid` bywa brutto (z podatkiem) i nie jest wpływem. */
export function subscriptionInvoiceNet(invoice: {
  currency?: string | null;
  amount_paid?: number | null;
  total_excluding_tax?: number | null;
  subtotal?: number | null;
}) {
  if (invoice.currency !== "pln") return null;
  if (typeof invoice.amount_paid !== "number" || invoice.amount_paid <= 0) return null;
  const cents = invoice.total_excluding_tax ?? invoice.subtotal;
  if (typeof cents !== "number" || !Number.isInteger(cents) || cents <= 0) return null;
  return new Decimal(cents).div(100);
}
