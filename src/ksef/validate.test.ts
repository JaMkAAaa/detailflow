import { expect, it } from "vitest";
import { invoiceFixture } from "../invoices/fixtures/document";
import { generateFa3 } from "./fa3";
import { validateFa3Xsd } from "./validate";
it("validates the pinned XSD and refuses invalid XML without diagnostics or invoice data", async () => {
  const xml = generateFa3(invoiceFixture());
  await expect(validateFa3Xsd(xml)).resolves.toBeUndefined();
  await expect(validateFa3Xsd(xml.replace("<WariantFormularza>3", "<WariantFormularza>2"))).rejects.toMatchObject({ status: 409 });
  await expect(validateFa3Xsd("<secret>private</secret>")).rejects.toThrow("Nie udało się zweryfikować");
});
