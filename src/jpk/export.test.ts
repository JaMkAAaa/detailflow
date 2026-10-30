import { Decimal } from "@prisma/client/runtime/client";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { invoiceFixture, correctionFixture } from "@/src/invoices/fixtures/document";
import { generateJpk, type JpkOptions } from "./export";
import { validateJpkXsd } from "./validate";

const options: JpkOptions = { from: "2026-10-01", to: "2026-10-31", env: "test", office: "1471", province: "mazowieckie", county: "Warszawa", municipality: "Warszawa", street: "Rzemieślnicza", building: "12", apartment: "" };
it("validates invoices and negative corrections against official JPK_FA(4) XSD, with exact control sums", async () => {
  const doc = invoiceFixture(); doc.invoice.items[0]!.name = 'Mycie <premium> & "ochrona"';
  const xml = generateJpk([doc, correctionFixture()], options);
  const result = spawnSync("xmllint", ["--nonet", "--noout", "--schema", "src/jpk/xsd/JPK_FA_4.xsd", "-"], { input: xml, encoding: "utf8" });
  expect(result.error).toBeUndefined(); expect(result.stderr).toContain("validates"); expect(result.status).toBe(0);
  await expect(validateJpkXsd(xml)).resolves.toBeUndefined();
  expect(xml).toContain("<WartoscFaktur>3630.00</WartoscFaktur>");
  expect(xml).toContain("<WartoscWierszyFaktur>2951.22</WartoscWierszyFaktur>");
  expect(xml).toContain("<LiczbaWierszyFaktur>4</LiczbaWierszyFaktur>");
  expect(xml).toContain("<P_11>-951.22</P_11>");
  expect(xml).toContain("<NrFaKorygowanej>FV/41/10/2026</NrFaKorygowanej>");
  expect(xml).toContain("&lt;premium&gt; &amp;");
  expect(xml).not.toContain("<P_9A>1000.00</P_9A>");
  await expect(validateJpkXsd(xml.replace("<WariantFormularza>4", "<WariantFormularza>3"))).rejects.toThrow();
});
it("refuses empty, draft, other environment, other studio and out-of-period invoices", () => {
  expect(() => generateJpk([], options)).toThrow(/Brak wystawionych/);
  for (const mutate of [
    (doc: ReturnType<typeof invoiceFixture>) => { doc.invoice.status = "draft"; },
    (doc: ReturnType<typeof invoiceFixture>) => { doc.invoice.ksefEnv = "production"; },
    (doc: ReturnType<typeof invoiceFixture>) => { doc.invoice.issuedAt = new Date("2026-09-30T12:00:00Z"); },
  ]) { const doc = invoiceFixture(); mutate(doc); expect(() => generateJpk([doc], options)).toThrow(); }
  const other = invoiceFixture(); other.invoice.studioId = "other";
  expect(() => generateJpk([invoiceFixture(), other], options)).toThrow(/poza zakresem/);
});
it("uses Warsaw issue dates and omits consumer tax identification", async () => {
  const doc = invoiceFixture(); doc.invoice.issuedAt = new Date("2026-09-30T22:30:00Z");
  const xml = generateJpk([doc], options);
  expect(xml).toContain("<P_1>2026-10-01</P_1>"); expect(xml).not.toContain("P_5B");
  await expect(validateJpkXsd(xml)).resolves.toBeUndefined();
});

it("maps all supported VAT groups with fractional quantities without recalculating amounts", async () => {
  const doc = invoiceFixture();
  doc.invoice.buyerNip = "5260250274";
  doc.invoice.items = [23, 8, 5, 0].map((vatRate, index) => ({ ...doc.invoice.items[0]!, id: String(index), lp: index + 1,
    quantity: new Decimal("1.5"), unitNet: new Decimal("100"), net: new Decimal("150"),
    vatRate, vat: new Decimal("150").times(vatRate).div(100), gross: new Decimal("150").times(new Decimal(1).plus(new Decimal(vatRate).div(100))),
  }));
  doc.invoice.totalNet = new Decimal("600"); doc.invoice.totalVat = new Decimal("54");
  doc.invoice.totalGross = doc.order.totalGross = new Decimal("654");
  const xml = generateJpk([doc], options);
  await expect(validateJpkXsd(xml)).resolves.toBeUndefined();
  for (const field of ["P_13_1", "P_13_2", "P_13_3", "P_13_6"]) expect(xml).toContain(`<${field}>150.00</${field}>`);
  expect(xml).toContain("<P_5B>5260250274</P_5B>");
});
