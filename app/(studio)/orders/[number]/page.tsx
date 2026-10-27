import { notFound } from "next/navigation";
import { MobileOrderDetails } from "@/components/zlecenia/MobileOrderDetails";
import { OrderDetails } from "@/components/zlecenia/OrderDetails";
import { parseTab } from "@/components/zlecenia/tabs";
import { findOrder } from "@/components/zlecenia/demo";

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [{ number }, { tab }] = await Promise.all([params, searchParams]);
  const order = findOrder(decodeURIComponent(number).replace(/^#/, ""));
  if (!order) notFound();
  return (
    <>
      <div className="lg:hidden">
        <MobileOrderDetails data={order} />
      </div>
      <div className="hidden lg:block">
        <OrderDetails data={order} initialTab={parseTab(Array.isArray(tab) ? tab[0] : tab)} />
      </div>
    </>
  );
}
