import Decimal from "decimal.js";

export type Environment = "test" | "production";
export type Item = { name: string; quantity: string; unitNet: string; vatRate: number; discount: string };
export type Buyer = { name: string; nip: string; street: string; postal: string; city: string; email: string };
export type Seller = { name: string; nip: string; address: string; postal: string; city: string; env: Environment };
export type Order = { id: string; number: string; vehicle: string; completedAt: string; buyer: Buyer; items: Item[] };
export type InvoiceView = {
  id: string; number: string; env: Environment; status: string; ksefStatus: string; ksefNumber: string | null;
  acceptedAt: string | null; issuedAt: string | null; saleAt: string | null; dueAt: string | null;
  paidAt: string | null; mailPending?: boolean; emailedAt: string | null; upoXml: string | null;
  kind: "invoice" | "correction"; correctsNumber: string | null; correctionReason: string | null; corrections: { number: string }[]; current: { lp: number; name: string; quantity: string; unitNet: string }[];
  orderNumber: string; buyer: Buyer; items: Item[];
  totalNet: string; totalVat: string; totalGross: string;
  events: { id: string; kind: string; at: string; message: string; ref: string | null }[];
};
export const money = (value: Decimal.Value) => new Decimal(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(".", ",") + " zł";
export const date = (value: string | null, time = false) => value ? new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", dateStyle: "short", ...(time ? { timeStyle: "medium" as const } : {}) }).format(new Date(value)) : "—";
export const envLabel = (env: Environment) => env === "test" ? "TEST" : "PROD";
export function invoiceNumberFromSegment(segment: string): string | null {
  try { return decodeURIComponent(segment); } catch { return null; }
}
export const invoiceHref = (number: string, env: Environment) => `/invoices/${encodeURIComponent(number)}?env=${env}`;
export function totals(items: Item[]) {
  const lines = items.map(item => {
    const net = new Decimal(item.unitNet).times(item.quantity).times(new Decimal(100).minus(item.discount).div(100)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const vat = net.times(item.vatRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return { ...item, net, vat, gross: net.plus(vat) };
  });
  const net = Decimal.sum(0, ...lines.map(line => line.net));
  const vat = Decimal.sum(0, ...lines.map(line => line.vat));
  return { lines, net, vat, gross: net.plus(vat) };
}
export function validItems(items: Item[]) {
  return items.length > 0 && items.every(item => /^\d{1,7}(\.\d{1,3})?$/.test(item.quantity) && new Decimal(item.quantity).gt(0)
    && /^\d{1,9}(\.\d{1,2})?$/.test(item.unitNet) && /^\d{1,3}(\.\d{1,2})?$/.test(item.discount) && new Decimal(item.discount).lte(100));
}
export function validNip(value: string) {
  const nip = value.replace(/[ -]/g, "");
  const digits = [...nip].map(Number);
  const checksum = digits.slice(0, 9).reduce((sum, n, i) => sum + n * [6,5,7,2,3,4,5,6,7][i]!, 0) % 11;
  return /^\d{10}$/.test(nip) && checksum === digits[9];
}
export function validBuyer(buyer: Buyer, company: boolean) {
  return !!buyer.name.trim() && !!buyer.street.trim() && /^\d{2}-\d{3}$/.test(buyer.postal) && !!buyer.city.trim()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email) && (!company || validNip(buyer.nip));
}
