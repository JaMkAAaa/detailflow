import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";

function wizardService(service: { id: string; code?: string; name: string; description: string; basePrice: Prisma.Decimal; durationMin: number }) {
  return {
    id: service.id,
    code: service.code,
    name: service.name,
    description: service.description,
    price: service.basePrice.toFixed(2),
    hours: new Prisma.Decimal(service.durationMin).mul("1.2").div(60).toString(),
    durationMin: service.durationMin,
  };
}

export async function loadQuoteWizard(studioId: string, authorId: string) {
  const db = studioDb(studioId);
  const [clients, services, quote] = await Promise.all([
    db.client.findMany({ where: { vehicles: { some: {} } }, orderBy: { name: "asc" }, include: { vehicles: { orderBy: { createdAt: "asc" } } } }),
    db.service.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }] }),
    db.quote.findFirst({ where: { authorId, status: { in: ["draft", "sent"] } }, orderBy: { createdAt: "desc" }, include: { items: { orderBy: { sort: "asc" } }, sendMail: { select: { sentAt: true } } } }),
  ]);
  const activeIds = new Set(services.filter((service) => service.active).map((service) => service.id));
  const heldIds = new Set((quote?.items ?? []).map((item) => item.serviceId).filter((id): id is string => !!id && !activeIds.has(id)));
  const heldFromCatalog = services.filter((service) => heldIds.has(service.id)).map((service) => ({ ...wizardService(service), inCatalog: false as const }));
  const seenMissing = new Set<string>();
  const heldMissing = (quote?.items ?? []).flatMap((item) => {
    if (!item.serviceId || activeIds.has(item.serviceId) || services.some((service) => service.id === item.serviceId) || seenMissing.has(item.serviceId)) return [];
    seenMissing.add(item.serviceId);
    return [{
      id: item.serviceId,
      name: item.name,
      description: "",
      price: item.basePrice.toFixed(2),
      hours: item.durationMin === null ? "0" : new Prisma.Decimal(item.durationMin).mul("1.2").div(60).toString(),
      durationMin: item.durationMin ?? 0,
      inCatalog: false as const,
    }];
  });
  return {
    clients: clients.map((client) => ({ id: client.id, name: client.name, email: client.email ?? "Brak adresu e-mail", vehicles: client.vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` })) })),
    services: services.filter((service) => service.active).map(wizardService),
    heldServices: [...heldFromCatalog, ...heldMissing],
    quote: quote ? {
      items: quote.items.map((item) => ({ serviceId: item.serviceId, name: item.name, basePrice: item.basePrice.toFixed(2), durationMin: item.durationMin })),
      id: quote.id, revision: quote.revision, status: quote.status, pending: !quote.sendMail?.sentAt,
      draft: { version: 1 as const, step: quote.wizardStep as 1 | 2 | 3, clientId: quote.clientId, vehicleId: quote.vehicleId, size: quote.size, paint: (quote.paintMult.eq("1.2") ? "worn" : quote.paintMult.eq("1.4") ? "heavy" : "standard") as "standard" | "worn" | "heavy", interior: quote.interior as "Lekkie" | "Umiarkowane" | "Silne", notes: quote.notes ?? "", slotId: quote.slotId as "oct24" | "oct26" | "oct28" | null, serviceIds: quote.items.map((item) => item.serviceId!).filter(Boolean) },
    } : null,
  };
}
export type QuoteWizardData = Awaited<ReturnType<typeof loadQuoteWizard>>;
