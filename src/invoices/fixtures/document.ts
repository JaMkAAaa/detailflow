import { Decimal } from "@prisma/client/runtime/client";
import type { InvoiceDocument } from "../document";

/** Completed DF-0243, deliberately distinct from the active DF-0248. */
export function invoiceFixture(): InvoiceDocument {
  const at = new Date("2026-10-24T08:12:08Z");
  return {
    seller: { name: "Obsidian Studio Michał Kowalski", nip: "9512345678", address: "ul. Rzemieślnicza 12", postal: "02-675", city: "Warszawa", env: "test" },
    order: { status: "completed", completedAt: at, totalGross: new Decimal("4800.00") },
    invoice: {
      id: "invoice-test", studioId: "studio-test", number: "FV/41/10/2026", workOrderId: "DF-0243", status: "issued", kind: "invoice", correctsInvoiceId: null, correctionReason: null, ksefEnv: "test", ksefStatus: "accepted",
      ksefNumber: "9512345678-20261024-8F3A21C4B7E0-5D", ksefAcceptedAt: at, ksefUpoXml: null,
      buyerName: "Adam Nowak & Syn", buyerNip: null, buyerStreet: "ul. Puławska 120/4", buyerPostal: "02-620", buyerCity: "Warszawa",
      issuedAt: at, saleAt: at, dueAt: new Date("2026-10-31T00:00:00Z"), paidAt: null, emailedAt: new Date("2026-10-24T08:13:08Z"), createdAt: at, updatedAt: at,
      totalNet: new Decimal("3902.44"), totalVat: new Decimal("897.56"), totalGross: new Decimal("4800.00"),
      items: ["Korekta lakieru · 2 etapy", "Powłoka ceramiczna 3 lata"].map((name, index) => ({
        id: `line-${index}`, studioId: "studio-test", invoiceId: "invoice-test", lp: index + 1, name, quantity: new Decimal("1"), unit: "usł.",
        unitNet: new Decimal("1951.22"), vatRate: 23, net: new Decimal("1951.22"), vat: new Decimal("448.78"), gross: new Decimal("2400.00"),
      })),
    },
  };
}
