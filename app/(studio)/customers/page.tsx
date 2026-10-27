import Link from "next/link";
import { EmptyState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listClients, PAGE_SIZE } from "@/src/server/klienci/clients";
import { requireStudio } from "@/src/server/studio/context";
import { ImportForm } from "./forms";

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function CustomersPage({ searchParams }: Props) {
  const { studioId } = await requireStudio();
  const params = await searchParams;
  const query = { page: Number(params.page) || 1, q: params.q?.trim() ?? "" };
  const data = await listClients(studioId, query);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const href = (page: number) => `/customers?page=${page}${query.q ? `&q=${encodeURIComponent(query.q)}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-df-section text-df-text">Klienci i auta</h1>
          <p className="text-df-body text-df-muted">
            {data.total} {query.q ? "z wyników" : "klientów"} · {data.vehicleTotal} aut · {PAGE_SIZE}/stronę
          </p>
        </div>
        <Link href="/customers/new" className={buttonVariants()}>Nowy klient</Link>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div className="flex flex-col gap-1.5">
            <label className="text-df-label text-df-muted" htmlFor="q">Szukaj</label>
            <Input id="q" name="q" defaultValue={query.q} placeholder="Klient, tablica, auto" className="w-72" />
          </div>
          <Button type="submit" variant="secondary">Szukaj</Button>
        </form>
        <ImportForm studioId={studioId} />
      </div>

      {!data.items.length ? (
        query.q ? (
          <EmptyState
            title={`Nie znaleziono „${query.q}”`}
            description="Zmień frazę albo wyczyść wyszukiwanie. Paginacja jest serwerowa — w wynikach nie ma ukrytych wierszy."
            actions={<Link href="/customers" className="text-df-body text-df-lime">Wyczyść wyszukiwanie</Link>}
          />
        ) : (
          <EmptyState
            title="Brak klientów"
            description="Dodaj osobę ręcznie albo wgraj CSV (imię, telefon, e-mail, marka, model, tablica)."
            actions={<Link href="/customers/new" className="text-df-body text-df-lime">Nowy klient</Link>}
          />
        )
      ) : (
        <div className="overflow-auto rounded-xl border border-df-line">
          <table className="w-full min-w-[720px] text-left text-df-body">
            <thead className="bg-df-raised text-df-label text-df-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Klient</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Auta</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((client) => (
                <tr key={client.id} className="border-t border-df-line">
                  <td className="px-4 py-3">
                    <Link href={`/customers/${client.id}`} className="text-df-text hover:text-df-lime">
                      {client.name}
                    </Link>
                    {client.isRegular && <span className="ml-2 text-df-label text-df-muted">stały</span>}
                  </td>
                  <td className="px-4 py-3 text-df-muted">{client.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-df-muted">{client.email ?? "—"}</td>
                  <td className="px-4 py-3 text-df-muted">
                    {client.vehicles.map((vehicle) => `${vehicle.make} ${vehicle.model} · ${vehicle.plate}`).join("; ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center gap-3 text-df-body" aria-label="Strony">
          {data.page > 1 ? <Link href={href(data.page - 1)} className="text-df-lime">Poprzednia</Link> : <span className="text-df-muted">Poprzednia</span>}
          <span className="text-df-muted">Strona {data.page} z {pages}</span>
          {data.page < pages ? <Link href={href(data.page + 1)} className="text-df-lime">Następna</Link> : <span className="text-df-muted">Następna</span>}
        </nav>
      )}
    </div>
  );
}
