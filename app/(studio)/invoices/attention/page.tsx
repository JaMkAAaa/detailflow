import { InvoiceAttention } from "@/components/faktury/InvoiceAttention";
import { invoiceList } from "@/src/server/faktury/list-query";
import { invoiceSeller } from "@/src/server/faktury/query";
import { requireStudio } from "@/src/server/studio/context";

export default async function InvoiceAttentionPage() {
  const { studioId, user } = await requireStudio("invoices:manage");
  const { env } = await invoiceSeller(studioId, user.id);
  return <InvoiceAttention studioId={studioId} key={`${studioId}:${env}`} invoices={await invoiceList(studioId, env)} env={env} now={new Date().toISOString()} />;
}
