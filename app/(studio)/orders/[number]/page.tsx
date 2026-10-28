import { notFound } from "next/navigation";
import { MobileOrderDetails } from "@/components/zlecenia/MobileOrderDetails";
import { OrderDetails } from "@/components/zlecenia/OrderDetails";
import { parseTab } from "@/components/zlecenia/tabs";
import { getOrder } from "@/src/server/zlecenia/orders";
import { OrderStateError } from "@/src/server/zlecenia/state";
import { requireStudio } from "@/src/server/studio/context";
import { toOrderDetails } from "@/components/zlecenia/order-view";

export default async function OrderPage({ params, searchParams }: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ number }, { tab }, { studioId, db }] = await Promise.all([params, searchParams, requireStudio("orders:write")]);
  let record;
  try { record = await getOrder(db, decodeURIComponent(number).replace(/^#/, "")); }
  catch (error) { if (error instanceof OrderStateError && error.code === "not_found") notFound(); throw error; }
  const data = toOrderDetails(record);
  const initialTab = parseTab(Array.isArray(tab) ? tab[0] : tab);
  return <>
    <div className="lg:hidden"><MobileOrderDetails data={data} studioId={studioId} /></div>
    <div className="hidden lg:block"><OrderDetails data={data} studioId={studioId} initialTab={initialTab} /></div>
  </>;
}
