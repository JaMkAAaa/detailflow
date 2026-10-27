import { expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { invoiceFixture } from "./fixtures/document";
import { generateInvoicePdf } from "./pdf";

async function content(buffer: Buffer) {
  const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: false });
  const pdf = await task.promise;
  const pages = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index);
    pages.push((await page.getTextContent()).items.map(item => "str" in item ? item.str : "").join(" "));
  }
  await task.destroy();
  return pages;
}
it("renders an A4 invoice with Polish glyphs, exact stored amounts and send date", async () => {
  const buffer = await generateInvoicePdf(invoiceFixture());
  expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  const pages = await content(buffer);
  expect(pages).toHaveLength(1);
  const text = pages.join(" ");
  for (const value of ["Faktura VAT", "FV/41/10/2026", "Rzemieślnicza", "Powłoka ceramiczna", "4 800,00 zł", "3 902,44 zł", "897,56 zł", "Wysłano PDF:", "24.10.2026", "10:13:08", "TRYB TESTOWY"]) expect(text).toContain(value);
});
it("labels PROD separately, handles unsent PDF and paginates many lines", async () => {
  const doc = invoiceFixture();
  doc.invoice.ksefEnv = "production"; doc.invoice.emailedAt = null;
  // Additional zero-value lines exercise wrapping without altering the monetary snapshot.
  doc.invoice.items.push(...Array.from({ length: 60 }, (_, index) => ({ ...doc.invoice.items[0]!, lp: index + 3,
    name: `Dodatkowa długa nazwa usługi pielęgnacji samochodu ${index}`, unitNet: doc.invoice.totalGross.mul(0), net: doc.invoice.totalGross.mul(0), vat: doc.invoice.totalGross.mul(0), gross: doc.invoice.totalGross.mul(0),
  })));
  const pages = await content(await generateInvoicePdf(doc));
  expect(pages.length).toBeGreaterThan(1);
  for (const page of pages) expect(page).toContain("FV/41/10/2026 · KSeF PROD");
  const text = pages.join(" ");
  expect(text).toContain("KSeF PROD"); expect(text).not.toContain("TRYB TESTOWY");
  expect(text).toContain("Wysłano PDF: nie wysłano");
  expect(text).toContain("samochodu 59");
});
