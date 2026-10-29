import { OrdersScreen } from "@/components/zlecenia/OrdersScreen";
import { requireStudio } from "@/src/server/studio/context";
import { loadOrderChoices } from "@/src/server/zlecenia/orders";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const createRequested = (await searchParams).new === "1";
  const { studioId } = await requireStudio("orders:write");
  const choices = await loadOrderChoices(studioId);
  return <OrdersScreen key={String(createRequested)} createRequested={createRequested} studioId={studioId} clients={choices.clients} services={choices.services} />;
}
