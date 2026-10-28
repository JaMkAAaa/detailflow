import { SupportScreen } from "@/components/admin/SupportScreen";
import { openTicketAction, replyToTicketAction, resolveTicketAction } from "./actions";
import { getSupportQueue } from "@/src/server/admin/support";

export const metadata = { title: "Wsparcie — Detailflow" };

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ticket = Array.isArray(params.ticket) ? params.ticket[0] : params.ticket;
  const data = await getSupportQueue(ticket ?? null);
  return (
    <SupportScreen
      data={data}
      replyAction={replyToTicketAction}
      openAction={openTicketAction}
      resolveAction={resolveTicketAction}
    />
  );
}
