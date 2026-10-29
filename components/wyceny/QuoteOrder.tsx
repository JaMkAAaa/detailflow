"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { OrderCreateForm, type OrderClientChoice } from "@/components/zlecenia/OrderCreateForm";

type Props = {
  studioId: string; status: string; orderNumber: string | null;
  quote: { id: string; clientId: string; vehicleId: string; service: string; totalGross: string };
  clients: OrderClientChoice[]; bays: { id: string; name: string }[];
};
export function QuoteOrder({ studioId, status, orderNumber, quote, clients, bays }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  if (orderNumber) return <Link className={buttonVariants()} href={`/orders/${orderNumber}`}>Otwórz zlecenie</Link>;
  if (status !== "accepted") return null;
  return <>
    <Button onClick={() => setOpen(true)}>Utwórz zlecenie</Button>
    {open && <section className="max-w-xl rounded-xl bg-df-panel p-5">
      <h2 className="text-df-section">Zlecenie z wyceny</h2>
      <OrderCreateForm studioId={studioId} quote={quote} clients={clients} services={[]} bays={bays}
        onCancel={() => setOpen(false)} onCreated={(order) => router.push(`/orders/${(order as { number: string }).number}`)} />
    </section>}
  </>;
}
