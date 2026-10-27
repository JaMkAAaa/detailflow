import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { seedServices } from "./catalog";

export async function loadQuoteWizard(studioId: string, authorId: string) {
  await seedServices(studioId);
  const db = studioDb(studioId);
  const [clients, services, quote] = await Promise.all([
    db.client.findMany({ where: { vehicles: { some: {} } }, orderBy: { name: "asc" }, include: { vehicles: { orderBy: { createdAt: "asc" } } } }),
    db.service.findMany({ orderBy: { sort: "asc" } }),
    db.quote.findFirst({ where: { authorId, status: { in: ["draft", "sent"] } }, orderBy: { createdAt: "desc" }, include: { items: { orderBy: { sort: "asc" } }, sendMail: { select: { sentAt: true } } } }),
  ]);
  return {
    clients: clients.map((client) => ({ id: client.id, name: client.name, email: client.email ?? "Brak adresu e-mail", vehicles: client.vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` })) })),
    services: services.map((service) => ({ id: service.id, code: service.code, name: service.name, description: service.description, price: service.basePrice.toFixed(2), hours: new Prisma.Decimal(service.durationMin).mul("1.2").div(60).toString(), durationMin: service.durationMin })),
    quote: quote ? {
      items: quote.items.map((item) => ({ serviceId: item.serviceId, name: item.name, basePrice: item.basePrice.toFixed(2), durationMin: item.durationMin })),
      id: quote.id, revision: quote.revision, status: quote.status, pending: !quote.sendMail?.sentAt,
      draft: { version: 1 as const, step: quote.wizardStep as 1 | 2 | 3, clientId: quote.clientId, vehicleId: quote.vehicleId, size: quote.size, paint: (quote.paintMult.eq("1.2") ? "worn" : quote.paintMult.eq("1.4") ? "heavy" : "standard") as "standard" | "worn" | "heavy", interior: quote.interior as "Lekkie" | "Umiarkowane" | "Silne", notes: quote.notes ?? "", slotId: quote.slotId as "oct24" | "oct26" | "oct28" | null, serviceIds: quote.items.map((item) => item.serviceId!).filter(Boolean) },
    } : null,
  };
}
export type QuoteWizardData = Awaited<ReturnType<typeof loadQuoteWizard>>;
