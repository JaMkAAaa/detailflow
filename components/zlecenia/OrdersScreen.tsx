"use client";

import { useCallback, useEffect, useState } from "react";
import { OrderErrorState } from "./OrderErrorState";
import { MobileOrders } from "./MobileOrders";
import { OrdersBoard } from "./OrdersBoard";
import { toBoardOrder, type ApiWorkOrder } from "./order-view";
import { postOrderStatus } from "./orders-client";
import { useRouter } from "next/navigation";
import { OrderCreateDialog } from "./OrderCreateDialog";
import type { OrderClientChoice, OrderServiceChoice } from "./OrderCreateDialog";

export function OrdersScreen({ studioId, clients, services, createRequested = false }: { createRequested?: boolean; studioId: string; clients: OrderClientChoice[]; services: OrderServiceChoice[] }) {
  const router = useRouter();
  const [orders, setOrders] = useState<ReturnType<typeof toBoardOrder>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endpoint = `/api/studios/${encodeURIComponent(studioId)}/orders`;

  const refresh = useCallback(async () => {
    const response = await fetch(endpoint);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "Nie udało się wczytać zleceń.");
    if (!Array.isArray(result)) throw new Error("Serwer zwrócił nieprawidłową listę zleceń.");
    setOrders((result as ApiWorkOrder[]).map(toBoardOrder));
  }, [endpoint]);

  useEffect(() => {
    refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Nie udało się wczytać zleceń."))
      .finally(() => setLoading(false));
  }, [refresh]);

  async function changeStatus(order: ReturnType<typeof toBoardOrder>, status: ReturnType<typeof toBoardOrder>["status"]) {
    const before = orders;
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    try { await postOrderStatus(studioId, order.id ?? order.number, status); }
    catch (cause) {
      setOrders(before);
      throw cause;
    }
    await refresh();
  }

  function created() {
    refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Zlecenie zapisano, ale nie udało się odświeżyć listy."));
  }

  if (loading) return <p role="status" className="text-df-body text-df-muted">Wczytywanie zleceń…</p>;
  if (error) return <OrderErrorState message={error} onRetry={() => { setError(""); setLoading(true); refresh().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Nie udało się wczytać zleceń.")).finally(() => setLoading(false)); }} />;

  return (
    <>
      {createRequested && <OrderCreateDialog studioId={studioId} clients={clients} services={services} onCreated={created} onClose={() => router.replace("/orders")} />}
      <div className="lg:hidden"><MobileOrders orders={orders} /></div>
      <div className="hidden lg:block"><OrdersBoard studioId={studioId} orders={orders} clients={clients} services={services} onCreated={created} onChangeStatus={changeStatus} /></div>
    </>
  );
}
