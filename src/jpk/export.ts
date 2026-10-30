import Decimal from "decimal.js";
import { create } from "xmlbuilder2";
import { z } from "zod";
import { InvoiceDocumentError, plDate, validateInvoiceDocument, type InvoiceDocument } from "@/src/invoices/document";

const text = (max: number) => z.string().trim().min(1).max(max);
export const jpkOptions = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  env: z.enum(["test", "production"]), office: z.string().regex(/^\d{4}$/),
  province: text(36), county: text(36), municipality: text(36),
  street: z.string().trim().max(65), building: text(9), apartment: z.string().trim().max(10),
});
export type JpkOptions = z.infer<typeof jpkOptions>;
export const JPK_NAMESPACE = "http://jpk.mf.gov.pl/wzor/2022/02/17/02171/";
const ETD = "http://crd.gov.pl/xml/schematy/dziedzinowe/mf/2018/08/24/eD/DefinicjeTypy/";

/** Domestic PLN VAT invoices and monetary corrections. Amounts are saved deltas. */
export function generateJpk(documents: InvoiceDocument[], options: JpkOptions, now = new Date()) {
  if (!documents.length) throw new InvoiceDocumentError("Brak wystawionych faktur w wybranym okresie i środowisku KSeF.");
  const root = create({ version: "1.0", encoding: "UTF-8" }).ele("JPK", { xmlns: JPK_NAMESPACE, "xmlns:etd": ETD });
  const header = root.ele("Naglowek");
  header.ele("KodFormularza", { kodSystemowy: "JPK_FA (4)", wersjaSchemy: "1-0" }).txt("JPK_FA");
  for (const [key, value] of Object.entries({ WariantFormularza: "4", CelZlozenia: "1", DataWytworzeniaJPK: now.toISOString(), DataOd: options.from, DataDo: options.to, KodUrzedu: options.office })) header.ele(key).txt(value);
  const seller = documents[0]!.seller;
  const nip = (value: string) => value.replace(/[ -]/g, "");
  const subject = root.ele("Podmiot1");
  subject.ele("IdentyfikatorPodmiotu").ele("NIP").txt(nip(seller.nip)).up().ele("PelnaNazwa").txt(seller.name);
  const address = subject.ele("AdresPodmiotu");
  const fields = { KodKraju: "PL", Wojewodztwo: options.province, Powiat: options.county, Gmina: options.municipality, Ulica: options.street, NrDomu: options.building, NrLokalu: options.apartment, Miejscowosc: seller.city, KodPocztowy: seller.postal };
  for (const [key, value] of Object.entries(fields)) if (value) address.ele(`etd:${key}`).txt(value);
  let gross = new Decimal(0), net = new Decimal(0), count = 0;
  for (const doc of documents) {
    validateInvoiceDocument(doc);
    const i = doc.invoice;
    if (i.studioId !== documents[0]!.invoice.studioId || i.ksefEnv !== options.env || plDate(i.issuedAt!) < options.from || plDate(i.issuedAt!) > options.to)
      throw new InvoiceDocumentError("Faktura poza zakresem eksportu JPK.");
    if (!seller.name.trim() || !/^\d{10}$/.test(nip(seller.nip)) || !seller.address.trim() || !seller.city || !seller.postal
      || !i.buyerName.trim() || !i.buyerStreet || !i.buyerPostal || !i.buyerCity)
      throw new InvoiceDocumentError("Uzupełnij dane sprzedawcy i nabywcy przed eksportem JPK.");
    const fa = root.ele("Faktura");
    for (const [key, value] of Object.entries({ KodWaluty: "PLN", P_1: plDate(i.issuedAt!), P_2A: i.number, P_3A: i.buyerName, P_3B: `${i.buyerStreet}, ${i.buyerPostal} ${i.buyerCity}`, P_3C: seller.name, P_3D: `${seller.address}, ${seller.postal} ${seller.city}`, P_4B: nip(seller.nip) })) fa.ele(key).txt(value);
    if (i.buyerNip) fa.ele("P_5B").txt(nip(i.buyerNip));
    fa.ele("P_6").txt(plDate(i.saleAt!));
    for (const [rate, suffix] of [[23, "1"], [8, "2"], [5, "3"]] as const) {
      const lines = i.items.filter(line => line.vatRate === rate);
      if (lines.length) { fa.ele(`P_13_${suffix}`).txt(Decimal.sum(...lines.map(line => line.net)).toFixed(2)); fa.ele(`P_14_${suffix}`).txt(Decimal.sum(...lines.map(line => line.vat)).toFixed(2)); }
    }
    const zero = i.items.filter(line => line.vatRate === 0);
    if (zero.length) fa.ele("P_13_6").txt(Decimal.sum(...zero.map(line => line.net)).toFixed(2));
    fa.ele("P_15").txt(i.totalGross.toFixed(2));
    for (const key of ["P_16", "P_17", "P_18", "P_18A", "P_19", "P_20", "P_21", "P_22", "P_23", "P_106E_2", "P_106E_3"]) fa.ele(key).txt("false");
    fa.ele("RodzajFaktury").txt(i.kind === "correction" ? "KOREKTA" : "VAT");
    if (i.kind === "correction") { fa.ele("PrzyczynaKorekty").txt(i.correctionReason!); fa.ele("NrFaKorygowanej").txt(doc.corrects!.number); }
    gross = gross.plus(i.totalGross);
  }
  root.ele("FakturaCtrl").ele("LiczbaFaktur").txt(String(documents.length)).up().ele("WartoscFaktur").txt(gross.toFixed(2));
  for (const { invoice: i } of documents) for (const line of i.items) {
    const row = root.ele("FakturaWiersz");
    row.ele("P_2B").txt(i.number); row.ele("P_7").txt(line.name);
    if (i.kind !== "correction") { row.ele("P_8A").txt(line.unit); row.ele("P_8B").txt(line.quantity.toString()); row.ele("P_9A").txt(line.unitNet.toFixed(2)); }
    row.ele("P_11").txt(line.net.toFixed(2)); row.ele("P_12").txt(String(line.vatRate));
    net = net.plus(line.net); count++;
  }
  root.ele("FakturaWierszCtrl").ele("LiczbaWierszyFaktur").txt(String(count)).up().ele("WartoscWierszyFaktur").txt(net.toFixed(2));
  return root.end({ prettyPrint: true });
}
