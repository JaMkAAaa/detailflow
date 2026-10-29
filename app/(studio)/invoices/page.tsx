import Link from "next/link";
import { InvoicesScreen } from "@/components/faktury/InvoicesScreen";
import { KsefEnvForm } from "@/components/faktury/KsefEnvForm";
import { invoiceList } from "@/src/server/faktury/list-query";
import { ksefStudioStatus } from "@/src/ksef/submissions";
import { requireStudio } from "@/src/server/studio/context";

export default async function InvoicesPage() {
  const context = await requireStudio("invoices:manage");
  const current = context.choices.find((choice) => choice.studioId === context.studioId)!;
  const status = await ksefStudioStatus(context.studioId);
  return (
    <div className="space-y-6">
      {current.role === "owner" && <KsefEnvForm env={status.env} prodAllowed={status.prodAllowed} tokenSet={status.tokenSet} />}
      {current.role === "owner" && <Link href="/settings" className="inline-block text-df-label text-df-lime">Ustawienia i token KSeF</Link>}
      <InvoicesScreen studioId={context.studioId} key={`${context.studioId}:${status.env}`} invoices={await invoiceList(context.studioId, status.env)} env={status.env} now={new Date().toISOString()} />
    </div>
  );
}
