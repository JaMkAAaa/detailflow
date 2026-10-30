"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OrderCreateForm, type OrderClientChoice, type OrderServiceChoice } from "./OrderCreateForm";

/** Ten sam formularz co dialog tablicy, gdy ktoś otworzy `/orders/new` na szerokim ekranie. */
export function DesktopOrderCreate({ studioId, clients, services }: {
  studioId: string; clients: OrderClientChoice[]; services: OrderServiceChoice[];
}) {
  const router = useRouter();
  const empty = clients.length === 0 || services.length === 0;
  return (
    <section className="mx-auto w-full max-w-[520px] rounded-xl border border-df-line bg-df-panel p-6">
      <h1 className="text-df-section">Nowe zlecenie</h1>
      {empty ? <p className="mt-4 text-df-body text-df-muted">Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.</p> : (
        <OrderCreateForm studioId={studioId} clients={clients} services={services} onCancel={() => router.push("/orders")} onCreated={() => { router.push("/orders"); router.refresh(); }} />
      )}
      {empty && <div className="mt-5 flex justify-end"><Link className={cn(buttonVariants({ variant: "secondary" }))} href="/orders">Zamknij</Link></div>}
    </section>
  );
}
