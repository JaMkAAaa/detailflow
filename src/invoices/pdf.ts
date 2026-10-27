import { createElement as h } from "react";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { date, envLabel, money } from "@/components/faktury/model";
import { validateInvoiceDocument, type InvoiceDocument } from "./document";

// Local, licensed font with Polish glyphs; also included in Next standalone output.
Font.register({ family: "Inter", src: path.join(process.cwd(), "app/fonts/Inter.ttf") });
const styles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 60, fontFamily: "Inter", fontSize: 10, lineHeight: 1.5, color: "#1f2124", backgroundColor: "#fafaf7" },
  title: { fontSize: 22, lineHeight: 1.4 }, muted: { color: "#737880", fontSize: 9 },
  section: { marginBottom: 20 }, row: { flexDirection: "row" }, party: { width: "50%", paddingRight: 18 },
  cell: { paddingVertical: 8, paddingRight: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#dbdbd9" },
  summary: { marginTop: 20, textAlign: "right" }, total: { fontSize: 18, lineHeight: 1.4, marginTop: 4 },
  footer: { position: "absolute", left: 36, right: 36, bottom: 24, color: "#737880", fontSize: 8 },
});

export async function generateInvoicePdf(document: InvoiceDocument): Promise<Buffer> {
  validateInvoiceDocument(document);
  const { invoice: i, seller } = document;
  const text = (value: string, style = {}) => h(Text, { style }, value);
  const widths = ["5%", "33%", "12%", "18%", "10%", "22%"];
  const row = (values: string[], header = false, key = "header") => h(View, { key, style: styles.tableRow, wrap: false },
    ...values.map((value, index) => text(value, { ...styles.cell, width: widths[index], textAlign: index > 1 ? "right" : "left", ...(header ? styles.muted : {}) })));
  return renderToBuffer(h(Document, { title: `Faktura ${i.number}`, author: seller.name, language: "pl-PL" },
    h(Page, { size: "A4", style: styles.page },
      h(View, { style: styles.section }, text("Faktura VAT", styles.title), text(i.number, { fontSize: 14, lineHeight: 1.4, color: "#737880" }),
        text(`KSeF ${envLabel(i.ksefEnv)}${i.ksefEnv === "test" ? " - TRYB TESTOWY. Dokument nie jest fakturą produkcyjną." : ""}`, styles.muted)),
      h(View, { style: [styles.row, styles.section] },
        h(View, { style: styles.party }, text("SPRZEDAWCA", styles.muted), text(seller.name), text(`NIP ${seller.nip}`), text(seller.address), text(`${seller.postal} ${seller.city}`)),
        h(View, { style: styles.party }, text("NABYWCA", styles.muted), text(i.buyerName), ...(i.buyerNip ? [text(`NIP ${i.buyerNip}`)] : []), text(i.buyerStreet ?? ""), text(`${i.buyerPostal ?? ""} ${i.buyerCity ?? ""}`))),
      h(View, { style: [styles.row, styles.section] },
        ...[["Data wystawienia", date(i.issuedAt!.toISOString())], ["Data sprzedaży", date(i.saleAt!.toISOString())], ["Termin płatności", date(i.dueAt?.toISOString() ?? null)]].map(([label, value]) =>
          h(View, { key: label, style: { width: "33%" } }, text(label!, styles.muted), text(value!)))),
      row(["LP", "NAZWA", "ILOŚĆ", "CENA NETTO", "VAT", "WARTOŚĆ NETTO"], true),
      ...i.items.map(line => row([String(line.lp), line.name, `${line.quantity.toString()} ${line.unit}`, money(line.unitNet).replace(" zł", ""), `${line.vatRate}%`, money(line.net).replace(" zł", "")], false, String(line.lp))),
      h(View, { style: styles.summary, wrap: false },
        text(`Netto ${money(i.totalNet)} · VAT ${money(i.totalVat)}`, styles.muted),
        text(`${i.paidAt ? "Zapłacono" : "Do zapłaty"}: ${money(i.totalGross)}`, styles.total),
        ...(i.ksefNumber ? [text(`Numer KSeF: ${i.ksefNumber}`, { ...styles.muted, marginTop: 18 })] : []),
        text(i.emailedAt ? `Wysłano PDF: ${date(i.emailedAt.toISOString(), true)}` : "Wysłano PDF: nie wysłano", { ...styles.muted, marginTop: 10 })),
      h(Text, { fixed: true, style: styles.footer }, `${i.number} · KSeF ${envLabel(i.ksefEnv)}`),
    )));
}
