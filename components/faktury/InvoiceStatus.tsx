import { Badge } from "@/components/ui/badge";
import type { InvoiceRow } from "./list-model";

export function InvoiceStatus({ invoice }: { invoice: InvoiceRow }) {
  if (invoice.status === "draft") return <Badge variant="draft" />;
  if (invoice.status === "canceled") return <Badge variant="accepted">Anulowana</Badge>;
  switch (invoice.ksefStatus) {
    case "accepted": return <Badge variant="accepted-test">{invoice.env === "test" ? "Przyjęta (test)" : "Przyjęta"}</Badge>;
    case "rejected": return <Badge variant="rejected" />;
    case "retrying": return <Badge variant="retry">Ponawiamy{invoice.events[0]?.attempt ? ` (${invoice.events[0].attempt}/8)` : ""}</Badge>;
    case "queued": return <Badge variant="processing">W kolejce</Badge>;
    case "processing": return <Badge variant="processing" />;
    default: return <Badge variant="accepted">Nie wysłano</Badge>;
  }
}
