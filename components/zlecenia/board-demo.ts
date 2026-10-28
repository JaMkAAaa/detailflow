/** Operational board types and display helpers. Live rows come from the orders API. */
export type OrderStatus = "accepted" | "in_progress" | "ready_for_pickup" | "completed" | "canceled";

export type BoardOrder = {
  id?: string;
  clientId?: string;
  number: string;
  vehicle: string;
  customer: string;
  plate: string;
  service: string;
  status: OrderStatus;
  dueLabel: string;
  grossPln: string;
  photo?: string;
};

export const columns: { status: OrderStatus; title: string; color: string }[] = [
  { status: "accepted", title: "Przyjęte", color: "text-df-muted" },
  { status: "in_progress", title: "W trakcie", color: "text-df-lime" },
  { status: "ready_for_pickup", title: "Do odbioru", color: "text-df-blue" },
  { status: "completed", title: "Zakończone", color: "text-df-green" },
  { status: "canceled", title: "Anulowane", color: "text-df-error" },
];

export type OrderFilters = { query: string; service: string };

export function filterOrders(orders: BoardOrder[], { query, service }: OrderFilters) {
  const needle = query.trim().toLocaleLowerCase("pl-PL");
  return orders.filter((order) =>
    (!service || order.service === service) &&
    (!needle || `${order.vehicle} ${order.customer} ${order.number} ${order.plate}`.toLocaleLowerCase("pl-PL").includes(needle)),
  );
}

export function ordersLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = count === 1 ? "zlecenie" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "zlecenia" : "zleceń";
  return `${count} ${noun}`;
}
