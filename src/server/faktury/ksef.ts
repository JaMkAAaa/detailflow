import { studioDb } from "@/lib/db/tenant";
import { AccessError } from "../acl";
import { invoiceDocument } from "./document";
import { generateFa3 } from "@/src/ksef/fa3";
import { validateFa3Xsd } from "@/src/ksef/validate";
import type { PrepareInvoiceXml } from "@/src/ksef/submissions";

export const prepareInvoiceXml: PrepareInvoiceXml = async (studioId, invoiceId) => {
  const invoice = await studioDb(studioId).invoice.findFirst({ where: { id: invoiceId }, select: { ksefEnv: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  const xml = generateFa3(await invoiceDocument(studioId, invoiceId, invoice.ksefEnv));
  return { xml, validateXsd: () => validateFa3Xsd(xml) };
};
