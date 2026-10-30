import { DesktopOrderCreate } from "@/components/zlecenia/DesktopOrderCreate";
import { MobileOrderCreate } from "@/components/zlecenia/MobileOrderCreate";
import { requireStudio } from "@/src/server/studio/context";
import { loadOrderCreate } from "@/src/server/zlecenia/orders";

export default async function NewOrderPage() {
  const { studioId, choices } = await requireStudio("orders:write");
  const studioName = choices.find((choice) => choice.studioId === studioId)?.studio.name ?? "";
  const data = await loadOrderCreate(studioId);
  return (
    <>
      <div className="lg:hidden">
        <MobileOrderCreate studioId={studioId} studioName={studioName} clients={data.clients} services={data.services} bays={data.bays} members={data.members} />
      </div>
      <div className="hidden lg:block">
        <DesktopOrderCreate studioId={studioId} clients={data.clients} services={data.services} />
      </div>
    </>
  );
}
