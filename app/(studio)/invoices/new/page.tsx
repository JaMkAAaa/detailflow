import { InvoiceWizard } from "@/components/faktury/InvoiceWizard";
import { invoiceOrders, invoiceSeller } from "@/src/server/faktury/query";
import { requireStudio } from "@/src/server/studio/context";

export default async function NewInvoicePage() {
  const { studioId, user } = await requireStudio("invoices:manage");
  const seller = await invoiceSeller(studioId, user.id);
  const orders = await invoiceOrders(studioId, seller.env);
  return <InvoiceWizard key={`${studioId}:${user.id}:${seller.env}`} studioId={studioId} userId={user.id} seller={seller} orders={orders} />;
}
