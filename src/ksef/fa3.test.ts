import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { correctionFixture, invoiceFixture } from "../invoices/fixtures/document";
import { generateFa3 } from "./fa3";

const schema = path.join(process.cwd(), "src/ksef/xsd/FA_3.xsd");
function validate(xml: string) {
  const result = spawnSync("xmllint", ["--nonet", "--noout", "--schema", schema, "-"], { input: xml, encoding: "utf8" });
  if (result.error) throw new Error("Install xmllint (libxml2-utils); XSD validation must not be skipped.", { cause: result.error });
  return result;
}
it.each([false, true])("validates consumer/company invoice against the pinned official FA(3) XSD (company=%s)", company => {
  const doc = invoiceFixture();
  if (company) doc.invoice.buyerNip = "1234567890";
  doc.invoice.items[0]!.name = 'Mycie <premium> & "ochrona"';
  const xml = generateFa3(doc, new Date("2026-10-24T10:00:00Z"));
  const result = validate(xml);
  expect(result.stderr).toContain("validates");
  expect(result.status).toBe(0);
  expect(xml).toContain("&lt;premium&gt; &amp;");
  expect(xml).toContain("<P_15>4800.00</P_15>");
  expect(xml).toContain(company ? "<NIP>1234567890</NIP>" : "<BrakID>1</BrakID>");
  // Prove the validator enforces FA(3), rather than merely parsing XML.
  expect(validate(xml.replace('<WariantFormularza>3</WariantFormularza>', '<WariantFormularza>2</WariantFormularza>')).status).not.toBe(0);
});
it("maps all supported VAT groups and fractional quantities in schema order", () => {
  const doc = invoiceFixture();
  doc.invoice.items = [23, 8, 5, 0].map((vatRate, index) => ({ ...doc.invoice.items[0]!, id: String(index), lp: index + 1,
    quantity: new Decimal("1.5"), unitNet: new Decimal("100"), net: new Decimal("150"),
    vatRate, vat: new Decimal("150").times(vatRate).div(100), gross: new Decimal("150").times(new Decimal(1).plus(new Decimal(vatRate).div(100))),
  }));
  doc.invoice.totalNet = new Decimal("600"); doc.invoice.totalVat = new Decimal("54");
  doc.invoice.totalGross = doc.order.totalGross = new Decimal("654");
  expect(validate(generateFa3(doc)).status).toBe(0);
});
it("uses Warsaw calendar dates around UTC midnight", () => {
  const doc = invoiceFixture(); doc.invoice.issuedAt = new Date("2026-10-23T23:30:00Z");
  expect(generateFa3(doc)).toContain("<P_1>2026-10-24</P_1>");
});
it.each(["gross", "order", "line", "draft", "unfinished"])("refuses inconsistent or ineligible invoices: %s", kind => {
  const doc = invoiceFixture();
  if (kind === "gross") doc.invoice.totalGross = new Decimal("4800.01");
  if (kind === "order") doc.order.totalGross = new Decimal("4800.01");
  if (kind === "line") doc.invoice.items[0]!.vat = new Decimal("448.79");
  if (kind === "draft") doc.invoice.status = "draft";
  if (kind === "unfinished") doc.order.status = "in_progress";
  expect(() => generateFa3(doc)).toThrow(/kwoty/);
});
it("does not round away a half-cent or invent missing seller details", () => {
  const doc = invoiceFixture(); doc.invoice.totalNet = new Decimal("3902.445");
  expect(() => generateFa3(doc)).toThrow();
  doc.invoice.totalNet = new Decimal("3902.44"); doc.seller.nip = "";
  expect(() => generateFa3(doc)).toThrow(/sprzedawcy/);
});

it.each(["test", "production"] as const)("exports a negative KOR with source reference and saved deltas (%s)", env => {
  const doc = correctionFixture();
  doc.invoice.ksefEnv = doc.corrects!.ksefEnv = doc.seller.env = env;
  const xml = generateFa3(doc);
  const result = validate(xml);
  expect(result.stderr).toContain("validates"); expect(result.status).toBe(0);
  for (const value of ["<RodzajFaktury>KOR</RodzajFaktury>", "<P_15>-1170.00</P_15>",
    "<P_13_1>-951.22</P_13_1>", "<P_14_1>-218.78</P_14_1>", "<P_11>-951.22</P_11>",
    "<NrFaKorygowanej>FV/41/10/2026</NrFaKorygowanej>", "<PrzyczynaKorekty>Rabat na ceramikę</PrzyczynaKorekty>",
    `<NrKSeFFaKorygowanej>${doc.corrects!.ksefNumber}</NrKSeFFaKorygowanej>`]) expect(xml).toContain(value);
  expect(xml).not.toContain("<P_9A>"); expect(xml).not.toContain("<P_8B>");
});
it("preserves the difference of HALF_UP rounded VAT, rather than rounding VAT of the difference", () => {
  const doc = correctionFixture();
  // Before: .03 net -> .01 VAT; after: .02 net -> .00 VAT.
  const line = doc.invoice.items[1]!;
  line.unitNet = new Decimal("0.02"); line.net = doc.invoice.totalNet = new Decimal("-0.01");
  line.vat = doc.invoice.totalVat = new Decimal("-0.01"); line.gross = doc.invoice.totalGross = new Decimal("-0.02");
  const xml = generateFa3(doc);
  expect(validate(xml).status).toBe(0);
  expect(xml).toContain("<P_14_1>-0.01</P_14_1>");
  expect(xml).toContain("<P_15>-0.02</P_15>");
});
it.each(["missing", "correction", "tenant", "env", "buyer", "sum", "reference"])("rejects invalid correction exports: %s", kind => {
  const doc = correctionFixture();
  if (kind === "missing") doc.corrects = undefined;
  if (kind === "correction") doc.corrects!.kind = "correction";
  if (kind === "tenant") doc.corrects!.studioId = "other";
  if (kind === "env") doc.corrects!.ksefEnv = "production";
  if (kind === "buyer") doc.invoice.buyerName = "Other buyer";
  if (kind === "sum") doc.invoice.totalGross = new Decimal("-1170.01");
  if (kind === "reference") doc.corrects!.ksefNumber = null;
  expect(() => generateFa3(doc)).toThrow();
});
