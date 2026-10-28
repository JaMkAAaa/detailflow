import { OrdersScreen } from "@/components/zlecenia/OrdersScreen";
import { requireStudio } from "@/src/server/studio/context";
import { loadOrderChoices } from "@/src/server/zlecenia/orders";

export default async function OrdersPage() {
  const { studioId } = await requireStudio("orders:write");
  const choices = await loadOrderChoices(studioId);
  return <OrdersScreen studioId={studioId} clients={choices.clients} services={choices.services} />;
}
