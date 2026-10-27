import Decimal from "decimal.js";
import type { Environment } from "./model";

export type InvoiceRow = {
  id: string; number: string; kind: "invoice" | "correction"; env: Environment; status: string; ksefStatus: string;
  buyerName: string; buyerNip: string | null; orderNumber: string; phone: string | null;
  issuedAt: string | null; dueAt: string | null; paidAt: string | null;
  totalGross: string; totalVat: string; ksefNumber: string | null;
  events: { kind: string; message: string; ref: string | null; attempt: number | null; at: string }[];
};
export const requiresKsefAttention = (row: InvoiceRow) => row.status === "issued" && ["rejected", "retrying"].includes(row.ksefStatus);
export const isUnpaid = (row: InvoiceRow) => row.kind === "invoice" && row.status === "issued" && row.ksefStatus === "accepted" && !row.paidAt;
const warsawDay = (value: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date(value));
export const isOverdue = (row: InvoiceRow, now: string) => isUnpaid(row) && !!row.dueAt && warsawDay(row.dueAt) < warsawDay(now);
export const sumInvoices = (rows: InvoiceRow[], field: "totalGross" | "totalVat" = "totalGross") => rows.reduce((sum, row) => sum.plus(row[field]), new Decimal(0)).toFixed(2);
export type InvoiceFilter = "all" | "accepted" | "processing" | "attention" | "draft" | "unpaid" | "overdue";
export function matchesInvoiceFilter(row: InvoiceRow, filter: InvoiceFilter, now: string) {
  switch (filter) {
    case "accepted": return row.status === "issued" && row.ksefStatus === "accepted";
    case "processing": return row.status === "issued" && ["queued", "processing"].includes(row.ksefStatus);
    case "attention": return requiresKsefAttention(row);
    case "draft": return row.status === "draft";
    case "unpaid": return isUnpaid(row);
    case "overdue": return isOverdue(row, now);
    default: return true;
  }
}
export function matchesInvoiceSearch(row: InvoiceRow, query: string) {
  const normalize = (value: string) => value.toLocaleLowerCase("pl").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/ł/g, "l");
  const term = normalize(query.trim());
  return normalize([row.number, row.buyerName, row.buyerNip, row.orderNumber].join(" ")).includes(term)
    || (!!row.buyerNip && /^\d[\d -]*$/.test(query.trim()) && row.buyerNip.replace(/\D/g, "").includes(query.replace(/\D/g, "")));
}
