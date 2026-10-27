import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { date, envLabel, money, totals, type Environment, type InvoiceView, type Seller } from "./model";

export const control = "h-10 w-full min-w-0 rounded-lg border border-df-line bg-df-bg px-3 text-df-body text-df-text";
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl bg-df-panel p-5", className)}>{children}</section>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-2 text-df-label text-df-muted">{label}{children}</label>;
}
export function EnvironmentBanner({ env }: { env: Environment }) {
  return <p className="rounded-lg bg-df-amber-dark px-3 py-2.5 text-df-body text-df-amber">KSeF — {envLabel(env)}{env === "test" ? " · TRYB TESTOWY · Te dokumenty nie są fakturami produkcyjnymi." : " · Środowisko produkcyjne."}</p>;
}
export function InvoicePreview({ invoice, seller }: { invoice: InvoiceView; seller: Seller }) {
  const lines = totals(invoice.items).lines;
  return <article aria-label="Podgląd faktury VAT" className="df-invoice-paper flex min-w-[590px] flex-col gap-[18px] rounded-md bg-[#fafaf7] px-9 pt-9 pb-8 text-[12px] leading-snug text-[#1f2124]">
    <header className="flex justify-between gap-4"><div><h2 className="text-[22px] font-bold">Faktura VAT</h2><p className="mt-1 text-[14px] text-[#737880]">{invoice.number}</p><p className="mt-1 text-[10px]">KSeF {envLabel(invoice.env)} · podgląd demonstracyjny</p></div>
      {invoice.ksefNumber && <figure className="flex flex-col items-center gap-1">
        {/* Exact Figma QR illustration, intentionally not a live MF verification code. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/faktury/qr-demo.png" width={72} height={72} alt="Demonstracyjny kod QR KSeF" />
        <figcaption className="text-[9px] text-[#737880]">KOD I · demonstracja KSeF</figcaption>
      </figure>}
    </header>
    <div className="grid grid-cols-2 gap-6"><div><p className="text-[10px] text-[#737880]">SPRZEDAWCA</p><strong>{seller.name}</strong><p>NIP {seller.nip || "—"}</p><p>{seller.address}, {seller.postal} {seller.city}</p></div><div><p className="text-[10px] text-[#737880]">NABYWCA</p><strong>{invoice.buyer.name}</strong>{invoice.buyer.nip && <p>NIP {invoice.buyer.nip}</p>}<p>{invoice.buyer.street}</p><p>{invoice.buyer.postal} {invoice.buyer.city}</p></div></div>
    <dl className="flex gap-6">{[["Data wystawienia", date(invoice.issuedAt)], ["Data sprzedaży", date(invoice.saleAt)], ["Płatność", `przelew do ${date(invoice.dueAt)}`]].map(([label, value]) => <div key={label}><dt className="text-[10px] text-[#737880]">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <table className="w-full text-left"><thead className="text-[10px] font-normal text-[#737880]"><tr>{["LP", "NAZWA", "ILOŚĆ", "CENA NETTO", "VAT", "WARTOŚĆ NETTO"].map(label => <th key={label} className="border-b border-[#dbdbd9] py-2 pr-2 font-normal">{label}</th>)}</tr></thead><tbody>{lines.map((item, i) => <tr key={i} className="border-b border-[#dbdbd9]"><td className="py-2">{i + 1}</td><td className="pr-2 font-medium">{item.name}{item.discount !== "0" && <span className="block text-[10px] text-[#737880]">Rabat {item.discount}%</span>}</td><td className="whitespace-nowrap pr-3">{item.quantity} usł.</td><td className="whitespace-nowrap pr-3">{money(item.unitNet).replace(" zł", "")}</td><td className="pr-3">{item.vatRate}%</td><td className="text-right">{money(item.net).replace(" zł", "")}</td></tr>)}</tbody></table>
    <div className="text-right"><p className="text-[#737880]">Netto {money(invoice.totalNet)} · VAT {money(invoice.totalVat)}</p><p className="mt-1 text-[18px] font-bold">Do zapłaty: {money(invoice.totalGross)}</p></div>
    {invoice.ksefNumber && <p className="break-all text-[10px] text-[#737880]">Numer KSeF: {invoice.ksefNumber}</p>}
    <p className="text-[10px] text-[#737880]">Wysłano PDF: {date(invoice.emailedAt, true)}{invoice.emailedAt && ` · ${invoice.buyer.email}`}</p>
  </article>;
}
