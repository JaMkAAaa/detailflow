import { OrdersBoard } from "@/components/zlecenia/OrdersBoard";
import { MobileOrders } from "@/components/zlecenia/MobileOrders";

export default function OrdersPage() {
  return (
    <>
      <div className="lg:hidden">
        <MobileOrders />
      </div>
      <div className="hidden lg:block">
        <OrdersBoard />
      </div>
    </>
  );
}
