import { notFound } from "next/navigation";
import { invoiceNumberFromSegment } from "@/components/faktury/model";
import { InvoiceDetails } from "@/components/faktury/InvoiceDetails";
import { invoiceDetail, invoiceSeller } from "@/src/server/faktury/query";
import { requireStudio } from "@/src/server/studio/context";

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ env?: string }> }) {
  const { studioId, user } = await requireStudio("invoices:manage");
  const [{ number }, search, seller] = await Promise.all([params, searchParams, invoiceSeller(studioId, user.id)]);
  if (search.env && search.env !== "test" && search.env !== "production") notFound();
  const decodedNumber = invoiceNumberFromSegment(number);
  if (!decodedNumber) notFound();
  const invoice = await invoiceDetail(studioId, decodedNumber, search.env === "test" || search.env === "production" ? search.env : seller.env);
  if (!invoice) notFound();
  return <InvoiceDetails key={`${studioId}:${invoice.id}`} studioId={studioId} invoice={invoice} seller={seller} />;
}
