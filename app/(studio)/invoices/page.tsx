import { InvoicesScreen } from "@/components/faktury/InvoicesScreen";
import { invoiceList } from "@/src/server/faktury/list-query";
import { invoiceSeller } from "@/src/server/faktury/query";
import { requireStudio } from "@/src/server/studio/context";

export default async function InvoicesPage() {
  const { studioId, user } = await requireStudio("invoices:manage");
  const { env } = await invoiceSeller(studioId, user.id);
  return <InvoicesScreen key={`${studioId}:${env}`} invoices={await invoiceList(studioId, env)} env={env} now={new Date().toISOString()} />;
}
