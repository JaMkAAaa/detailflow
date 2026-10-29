import Decimal from "decimal.js";
import { create } from "xmlbuilder2";
import { InvoiceDocumentError, plDate, validateInvoiceDocument, type InvoiceDocument } from "../invoices/document";

export const FA3_NAMESPACE = "http://crd.gov.pl/wzor/2025/06/25/13775/";

/** Domestic PLN VAT invoice or monetary correction, using persisted amounts. */
export function generateFa3(document: InvoiceDocument, generatedAt = new Date()): string {
  validateInvoiceDocument(document);
  const { invoice: i, seller } = document;
  const nip = (value: string) => value.replace(/[ -]/g, "");
  if (!/^\d{10}$/.test(nip(seller.nip)) || (i.buyerNip && !/^\d{10}$/.test(nip(i.buyerNip)))
    || !seller.name.trim() || !seller.address.trim() || !seller.postal || !seller.city
    || !i.buyerName.trim() || !i.buyerStreet || !i.buyerPostal || !i.buyerCity) {
    throw new InvoiceDocumentError("Uzupełnij dane sprzedawcy i nabywcy przed eksportem XML.");
  }
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("Faktura", { xmlns: FA3_NAMESPACE });
  root.ele("Naglowek").ele("KodFormularza", { kodSystemowy: "FA (3)", wersjaSchemy: "1-0E" }).txt("FA").up()
    .ele("WariantFormularza").txt("3").up().ele("DataWytworzeniaFa").txt(generatedAt.toISOString()).up()
    .ele("SystemInfo").txt("Detailflow");
  const sellerNode = root.ele("Podmiot1");
  sellerNode.ele("DaneIdentyfikacyjne").ele("NIP").txt(nip(seller.nip)).up().ele("Nazwa").txt(seller.name);
  sellerNode.ele("Adres").ele("KodKraju").txt("PL").up().ele("AdresL1").txt(seller.address).up()
    .ele("AdresL2").txt(`${seller.postal} ${seller.city}`);
  const buyer = root.ele("Podmiot2"), identity = buyer.ele("DaneIdentyfikacyjne");
  if (i.buyerNip) identity.ele("NIP").txt(nip(i.buyerNip));
  else identity.ele("BrakID").txt("1");
  identity.ele("Nazwa").txt(i.buyerName);
  buyer.ele("Adres").ele("KodKraju").txt("PL").up().ele("AdresL1").txt(i.buyerStreet!).up()
    .ele("AdresL2").txt(`${i.buyerPostal} ${i.buyerCity}`);
  buyer.ele("JST").txt("2"); buyer.ele("GV").txt("2");
  const fa = root.ele("Fa");
  fa.ele("KodWaluty").txt("PLN"); fa.ele("P_1").txt(plDate(i.issuedAt!));
  fa.ele("P_2").txt(i.number); fa.ele("P_6").txt(plDate(i.saleAt!));
  for (const [rate, netField, vatField] of [[23, "P_13_1", "P_14_1"], [8, "P_13_2", "P_14_2"], [5, "P_13_3", "P_14_3"], [0, "P_13_6_1", null]] as const) {
    const lines = i.items.filter(line => line.vatRate === rate);
    if (!lines.length) continue;
    fa.ele(netField).txt(Decimal.sum(...lines.map(line => line.net)).toFixed(2));
    if (vatField) fa.ele(vatField).txt(Decimal.sum(...lines.map(line => line.vat)).toFixed(2));
  }
  fa.ele("P_15").txt(i.totalGross.toFixed(2));
  const notes = fa.ele("Adnotacje");
  for (const field of ["P_16", "P_17", "P_18", "P_18A"]) notes.ele(field).txt("2");
  notes.ele("Zwolnienie").ele("P_19N").txt("1");
  notes.ele("NoweSrodkiTransportu").ele("P_22N").txt("1");
  notes.ele("P_23").txt("2"); notes.ele("PMarzy").ele("P_PMarzyN").txt("1");
  const correction = i.kind === "correction";
  fa.ele("RodzajFaktury").txt(correction ? "KOR" : "VAT");
  if (correction) {
    const source = document.corrects!;
    // All corrections created by this API follow KSeF acceptance. Missing reference
    // is incomplete data, never evidence that the source was issued outside KSeF.
    if (!source.ksefNumber) throw new InvoiceDocumentError("Brak numeru KSeF faktury korygowanej.");
    fa.ele("PrzyczynaKorekty").txt(i.correctionReason!);
    const reference = fa.ele("DaneFaKorygowanej");
    reference.ele("DataWystFaKorygowanej").txt(plDate(source.issuedAt!));
    reference.ele("NrFaKorygowanej").txt(source.number);
    reference.ele("NrKSeF").txt("1");
    reference.ele("NrKSeFFaKorygowanej").txt(source.ksefNumber);
  }
  for (const line of i.items) {
    const row = fa.ele("FaWiersz");
    row.ele("NrWierszaFa").txt(String(line.lp)); row.ele("P_7").txt(line.name);
    // Quantity/unitNet on a correction store the AFTER state, not a difference.
    // Export only the stored monetary delta; do not mix these two meanings.
    if (!correction) {
      row.ele("P_8A").txt(line.unit); row.ele("P_8B").txt(line.quantity.toString());
      row.ele("P_9A").txt(line.unitNet.toFixed(2));
    }
    row.ele("P_11").txt(line.net.toFixed(2));
    row.ele("P_12").txt(line.vatRate === 0 ? "0 KR" : String(line.vatRate));
  }
  return root.end({ prettyPrint: true });
}
