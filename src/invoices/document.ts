import Decimal from "decimal.js";
import type { Invoice, InvoiceItem, WorkOrder } from "@/lib/db/generated/client";
import type { Seller } from "@/components/faktury/model";

export type InvoiceDocument = {
  invoice: Invoice & { items: InvoiceItem[] };
  corrects?: Invoice;
  seller: Seller;
  order: Pick<WorkOrder, "totalGross" | "status" | "completedAt">;
};

export class InvoiceDocumentError extends Error {}

/** Exports use the persisted monetary snapshot, never reverse-calculate net from gross. */
export function validateInvoiceDocument({ invoice: i, order, corrects }: InvoiceDocument) {
  const fail = () => { throw new InvoiceDocumentError("Niekompletna faktura lub kwoty niezgodne ze zleceniem."); };
  if (i.status !== "issued" || !i.issuedAt || !i.saleAt || order.status !== "completed" || !order.completedAt || !i.items.length) fail();
  const correction = i.kind === "correction";
  if (correction) {
    if (!corrects || corrects.kind !== "invoice" || corrects.id !== i.correctsInvoiceId
      || corrects.studioId !== i.studioId || corrects.ksefEnv !== i.ksefEnv || corrects.workOrderId !== i.workOrderId || !corrects.issuedAt
      || !i.correctionReason?.trim()
      || (["buyerName", "buyerNip", "buyerStreet", "buyerPostal", "buyerCity"] as const).some(key => corrects[key] !== i[key])) fail();
  } else if (i.correctsInvoiceId || corrects) fail();
  const amount = (value: Decimal.Value, signed = correction) => {
    const n = new Decimal(value);
    if (!n.isFinite() || (!signed && n.lt(0)) || n.decimalPlaces() > 2) fail();
    return n;
  };
  let net = new Decimal(0), vat = new Decimal(0), gross = new Decimal(0);
  for (const line of i.items) {
    const n = amount(line.net), v = amount(line.vat), g = amount(line.gross);
    if (!n.plus(v).eq(g) || ![23, 8, 5, 0].includes(line.vatRate)
      || !new Decimal(line.quantity).isFinite() || (correction ? new Decimal(line.quantity).lt(0) : !new Decimal(line.quantity).gt(0))
      || new Decimal(line.quantity).decimalPlaces() > 3 || !line.name.trim() || !line.unit.trim()) fail();
    amount(line.unitNet, false);
    // A correction stores rounded deltas, but quantity and unitNet are its AFTER state.
    if (!correction && (!new Decimal(line.unitNet).times(line.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).eq(n)
      || !n.times(line.vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).eq(v))) fail();
    net = net.plus(n); vat = vat.plus(v); gross = gross.plus(g);
  }
  if (!amount(i.totalNet).eq(net) || !amount(i.totalVat).eq(vat) || !amount(i.totalGross).eq(gross)
    || !net.plus(vat).eq(gross) || (!correction && !gross.eq(order.totalGross))) fail();
}

export const plDate = (date: Date) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
