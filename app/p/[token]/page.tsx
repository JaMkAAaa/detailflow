import type { Metadata } from "next";
import { PortalExpired, PortalStatus } from "@/components/portal/PortalScreen";
import { LogoMark } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { readPortal } from "@/src/server/portal/links";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal klienta", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function PortalPage({ params, searchParams }: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ unavailable?: string }>;
}) {
  const { token } = await params;
  const { unavailable } = await searchParams;
  const data = unavailable ? null : await readPortal(token);
  if (!data) return <PortalExpired />;
  if (data.order) {
    const { studio, order } = data;
    return <PortalStatus studio={studio} order={{
      number: order.number, customerName: order.client.name, vehicle: order.vehicle,
      status: order.status, stage: order.stage, pickupAt: order.dueAt ?? order.scheduledTo,
      totalGross: order.totalGross.toFixed(2), service: order.service, updatedAt: order.updatedAt,
    }} />;
  }
  const { studio, quote } = data;
  const decided = quote?.status === "accepted" || quote?.status === "rejected";
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
    <header className="flex items-center gap-3 border-b border-df-line pb-5"><LogoMark /><span className="font-brand text-xl font-bold">{studio.name}</span></header>
    <p className="text-df-label text-df-muted">Portal klienta</p>
    <h1 className="text-df-headline">{decided ? "Dziękujemy za decyzję" : "Twoja wycena"}</h1>
    {quote ? <section aria-label="Wycena" className="flex flex-col gap-4 rounded-2xl bg-df-panel p-5">
      <h2 className="text-df-section">{quote.vehicle.make} {quote.vehicle.model} · {quote.vehicle.plate}</h2>
      <ul className="flex flex-col gap-2 text-df-muted">{quote.items.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
      <p className="flex justify-between border-t border-df-line pt-4"><span>Razem brutto</span><strong>{quote.totalGross.toFixed(2).replace(".", ",")} PLN</strong></p>
      {quote.notes && <p className="whitespace-pre-wrap text-df-muted">{quote.notes}</p>}
      {decided ? <p role="status" className="text-df-lime">{quote.status === "accepted" ? "Wycena zaakceptowana." : "Wycena odrzucona."} Decyzja została zapisana. Powiadomimy studio.</p>
        : quote.status === "sent" && !quote.decidedAt ? <form action={`/p/${encodeURIComponent(token)}/decision`} method="post" className="flex flex-wrap gap-3">
          <Button type="submit" name="decision" value="accepted">Akceptuję wycenę</Button>
          <Button type="submit" name="decision" value="rejected" variant="secondary">Odrzucam wycenę</Button>
        </form> : <p className="text-df-muted">Ta wycena nie oczekuje na decyzję.</p>}
    </section> : <p className="text-df-muted">Brak wyceny oczekującej na decyzję.</p>}
    {studio.phone && <a href={`tel:${studio.phone}`} className="text-df-lime underline">Zadzwoń do studia: {studio.phone}</a>}
  </main>;
}
