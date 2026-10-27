import { ClientsScreen } from "@/components/klienci/ClientsScreen";
import { listClients } from "@/src/server/klienci/directory";
import { parseClientsQuery } from "@/src/server/klienci/query";
import { requireStudio } from "@/src/server/studio/context";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { studioId } = await requireStudio();
  const data = await listClients(studioId, parseClientsQuery(await searchParams));
  return <ClientsScreen data={data} />;
}
