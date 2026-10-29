import { ServicesScreen } from "@/components/uslugi/ServicesScreen";
import { requireStudio } from "@/src/server/studio/context";
import { listServices } from "@/src/server/wyceny/catalog";
import { createServiceAction, deleteServiceAction, updateServiceAction } from "./actions";

export default async function ServicesPage() {
  const { studioId } = await requireStudio("services:manage");
  const services = await listServices(studioId);
  return (
    <ServicesScreen
      studioId={studioId}
      services={services}
      actions={{ create: createServiceAction, update: updateServiceAction, remove: deleteServiceAction }}
    />
  );
}
