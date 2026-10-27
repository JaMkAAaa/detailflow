import { QuoteWizard } from "@/components/wyceny/QuoteWizard";
import { requireStudio } from "@/src/server/studio/context";

export default async function NewQuotePage() {
  const { studioId, user, db } = await requireStudio("quotes:write");
  const clients = await db.client.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, vehicles: { select: { id: true, make: true, model: true, plate: true } } } });
  const choices = clients.filter((client) => client.vehicles.length).map((client) => ({ ...client, vehicles: client.vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` })) }));
  return <QuoteWizard key={`${studioId}:${user.id}`} studioId={studioId} userId={user.id} clientChoices={choices} />;
}
