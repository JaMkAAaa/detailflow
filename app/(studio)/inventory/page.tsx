import { InventoryScreen } from "@/components/magazyn/InventoryScreen";
import { requireStudio } from "@/src/server/studio/context";
import { listChemicals } from "@/src/server/magazyn/inventory";
import { createChemicalAction, correctChemicalAction } from "./actions";

export default async function InventoryPage() {
  const { studioId, member, restriction } = await requireStudio();
  return <InventoryScreen key={studioId} studioId={studioId} chemicals={await listChemicals(studioId)} canManage={member.role !== "worker" && !restriction} actions={{ create: createChemicalAction, correct: correctChemicalAction }} />;
}
