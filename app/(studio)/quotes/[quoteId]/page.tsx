import { notFound } from "next/navigation";
import { requireStudio } from "@/src/server/studio/context";
import { QuoteOrder } from "@/components/wyceny/QuoteOrder";

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const { studioId, db } = await requireStudio("quotes:write");
  const quote = await db.quote.findFirst({ where: { id: quoteId }, include: {
    client: true, vehicle: true, items: { orderBy: { sort: "asc" } }, order: { select: { number: true } },
  } });
  if (!quote) notFound();
  const bays = await db.bay.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true } });
  const service = quote.items.map((item) => item.name).join(", ");
  return <div className="flex flex-col items-start gap-5">
    <h1 className="text-df-headline">Wycena</h1>
    <p>{({ accepted: "Zaakceptowana", rejected: "Odrzucona", draft: "Szkic", sent: "Wysłana", expired: "Wygasła" })[quote.status]}</p>
    <p>{quote.client.name} · {quote.vehicle.make} {quote.vehicle.model} · {quote.vehicle.plate}</p>
    <p>{service} · {quote.totalGross.toFixed(2)} PLN</p>
    <QuoteOrder studioId={studioId} status={quote.status} orderNumber={quote.order?.number ?? null}
      quote={{ id: quote.id, clientId: quote.clientId, vehicleId: quote.vehicleId, service, totalGross: quote.totalGross.toFixed(2) }}
      clients={[{ id: quote.client.id, name: quote.client.name, vehicles: [{ id: quote.vehicle.id, label: `${quote.vehicle.make} ${quote.vehicle.model} · ${quote.vehicle.plate}` }] }]} bays={bays} />
  </div>;
}
