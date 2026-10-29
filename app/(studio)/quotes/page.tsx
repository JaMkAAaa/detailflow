import Link from "next/link";
import { requireStudio } from "@/src/server/studio/context";
import { buttonVariants } from "@/components/ui/button";

export default async function QuotesPage() {
  const { db } = await requireStudio("quotes:write");
  const quotes = await db.quote.findMany({ orderBy: { createdAt: "desc" }, take: 100, include: { client: true, vehicle: true } });
  return <div className="flex flex-col items-start gap-5">
    <h1 className="text-df-headline">Wyceny</h1>
    <Link className={buttonVariants()} href="/quotes/new">Nowa wycena</Link>
    {quotes.map((quote) => <Link className="rounded-xl bg-df-panel p-4" key={quote.id} href={`/quotes/${quote.id}`}>
      {quote.client.name} · {quote.vehicle.make} {quote.vehicle.model} · {quote.totalGross.toFixed(2)} PLN · {({ accepted: "Zaakceptowana", rejected: "Odrzucona", draft: "Szkic", sent: "Wysłana", expired: "Wygasła" })[quote.status]}
    </Link>)}
    {!quotes.length && <p>Brak wycen.</p>}
  </div>;
}
