import Decimal from "decimal.js";
import type { Invoice, InvoiceItem, WorkOrder } from "@/lib/db/generated/client";
import type { Seller } from "@/components/faktury/model";

export type InvoiceDocument = {
  invoice: Invoice & { items: InvoiceItem[] };
  seller: Seller;
  order: Pick<WorkOrder, "totalGross" | "status" | "completedAt">;
};

export class InvoiceDocumentError extends Error {}

/** Exports use the persisted monetary snapshot, never reverse-calculate net from gross. */
export function validateInvoiceDocument({ invoice: i, order }: InvoiceDocument) {
  const fail = () => { throw new InvoiceDocumentError("Niekompletna faktura lub kwoty niezgodne ze zleceniem."); };
  if (i.status !== "issued" || !i.issuedAt || !i.saleAt || order.status !== "completed" || !order.completedAt || !i.items.length) fail();
  const amount = (value: Decimal.Value) => {
    const n = new Decimal(value);
    if (!n.isFinite() || n.lt(0) || n.decimalPlaces() > 2) fail();
    return n;
  };
  let net = new Decimal(0), vat = new Decimal(0), gross = new Decimal(0);
  for (const line of i.items) {
    const n = amount(line.net), v = amount(line.vat), g = amount(line.gross);
    if (!n.plus(v).eq(g) || ![23, 8, 5, 0].includes(line.vatRate)
      || !new Decimal(line.quantity).isFinite() || !new Decimal(line.quantity).gt(0)
      || new Decimal(line.quantity).decimalPlaces() > 3 || !line.name.trim() || !line.unit.trim()) fail();
    amount(line.unitNet);
    if (!new Decimal(line.unitNet).times(line.quantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).eq(n)
      || !n.times(line.vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).eq(v)) fail();
    net = net.plus(n); vat = vat.plus(v); gross = gross.plus(g);
  }
  if (!amount(i.totalNet).eq(net) || !amount(i.totalVat).eq(vat) || !amount(i.totalGross).eq(gross)
    || !net.plus(vat).eq(gross) || !gross.eq(order.totalGross)) fail();
}

export const plDate = (date: Date) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit",
}).format(date);
