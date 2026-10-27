import { studioDb } from "@/lib/db/tenant";
import { AccessError } from "../acl";
import type { Environment } from "@/components/faktury/model";
import { InvoiceDocumentError, validateInvoiceDocument, type InvoiceDocument } from "@/src/invoices/document";

export async function invoiceDocument(studioId: string, invoiceId: string, environment: Environment): Promise<InvoiceDocument> {
  const invoice = await studioDb(studioId).invoice.findFirst({
    where: { studioId, id: invoiceId, ksefEnv: environment },
    include: {
      items: { where: { studioId }, orderBy: { lp: "asc" } },
      studio: { select: { name: true, ownerLegalName: true, nip: true, address: true, postal: true, city: true } },
      workOrder: { select: { status: true, completedAt: true, totalGross: true } },
    },
  });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  const document: InvoiceDocument = {
    invoice, order: invoice.workOrder,
    seller: { name: invoice.studio.ownerLegalName ?? invoice.studio.name, nip: invoice.studio.nip ?? "", address: invoice.studio.address ?? "", postal: invoice.studio.postal ?? "", city: invoice.studio.city ?? "", env: environment },
  };
  validateInvoiceDocument(document);
  return document;
}

export function documentError(error: unknown) {
  return error instanceof InvoiceDocumentError
    ? Response.json({ error: error.message }, { status: 409 }) : null;
}
