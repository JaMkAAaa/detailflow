"use client";

import { useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderCreateForm, type OrderClientChoice, type OrderServiceChoice } from "./OrderCreateForm";

export type { OrderClientChoice, OrderServiceChoice };
type Props = { studioId: string; clients: OrderClientChoice[]; services: OrderServiceChoice[]; onCreated: (order: unknown) => void; onClose: () => void };

export function OrderCreateDialog({ studioId, clients, services, onCreated, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} aria-labelledby="new-order-title" onCancel={onClose} className="fixed inset-0 m-auto max-h-[calc(100%-32px)] w-[520px] max-w-[calc(100%-32px)] overflow-y-auto rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60">
      <h2 id="new-order-title" className="text-df-section">Nowe zlecenie</h2>
      {clients.length === 0 || services.length === 0 ? <p className="mt-4 text-df-body text-df-muted">Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.</p> : (
        <OrderCreateForm studioId={studioId} clients={clients} services={services} onCancel={onClose} onCreated={(order) => { onCreated(order); onClose(); }} />
      )}
      {(clients.length === 0 || services.length === 0) && <div className="mt-5 flex justify-end"><button className={cn(buttonVariants({ variant: "secondary" }))} onClick={onClose}>Zamknij</button></div>}
    </dialog>
  );
}
