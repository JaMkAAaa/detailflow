import type { OrderStatus } from "./board-demo";

export async function postOrderStatus(studioId: string, orderId: string, status: OrderStatus) {
  const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/orders/${encodeURIComponent(orderId)}/status`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? "Nie udało się zmienić statusu zlecenia.");
  return result;
}
