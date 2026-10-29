import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/src/server/klienci/clients";
import { ClientError } from "@/src/server/klienci/errors";
import { requireStudio } from "@/src/server/studio/context";
import { ClientPrivacyActions } from "../privacy-actions";
import { ClientForm, DeleteButton, VehicleForm } from "../forms";

const statusLabel = {
  accepted: "Przyjęte", in_progress: "W trakcie", ready_for_pickup: "Do odbioru",
  completed: "Zakończone", canceled: "Anulowane",
} as const;

export default async function CustomerPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { studioId, member } = await requireStudio();
  const { clientId } = await params;
  const client = await getClient(studioId, clientId).catch((error) => {
    if (error instanceof ClientError && error.status === 404) notFound();
    throw error;
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/customers" className="text-df-body text-df-muted hover:text-df-text">← Klienci</Link>
        <h1 className="mt-2 text-df-section text-df-text">{client.name}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-df-strong text-df-text">Dane</h2>
        <ClientForm studioId={studioId} client={client} />
        <DeleteButton url={`/api/studios/${studioId}/clients/${client.id}`} label="Usuń klienta" confirm="Usunąć klienta i jego auta bez historii?" />
      </section>

      {member.role !== "worker" && <ClientPrivacyActions studioId={studioId} clientId={client.id} />}

      <section className="flex flex-col gap-4">
        <h2 className="text-df-strong text-df-text">Auta</h2>
        <ul className="divide-y divide-df-line rounded-xl border border-df-line">
          {client.vehicles.map((vehicle) => (
            <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-df-body">
              <span>{vehicle.make} {vehicle.model} · {vehicle.plate}{vehicle.year ? ` · ${vehicle.year}` : ""}</span>
              <DeleteButton url={`/api/studios/${studioId}/vehicles/${vehicle.id}`} label="Usuń auto" confirm="Usunąć to auto?" href={null} />
            </li>
          ))}
          {!client.vehicles.length && <li className="px-4 py-3 text-df-muted">Brak aut.</li>}
        </ul>
        <VehicleForm studioId={studioId} clientId={client.id} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-df-strong text-df-text">Historia</h2>
        {client.orders.length ? (
          <table className="w-full text-left text-df-body">
            <thead className="text-df-label text-df-muted">
              <tr>
                <th className="py-2 font-medium">Zlecenie</th>
                <th className="py-2 font-medium">Auto</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Kwota</th>
              </tr>
            </thead>
            <tbody>
              {client.orders.map((order) => (
                <tr key={order.id} className="border-t border-df-line">
                  <td className="py-2">
                    <Link href={`/orders/${order.number}`} className="text-df-lime">#{order.number}</Link>
                    <span className="text-df-muted"> · {order.service}</span>
                  </td>
                  <td className="py-2 text-df-muted">{order.vehicle.make} {order.vehicle.model} · {order.vehicle.plate}</td>
                  <td className="py-2 text-df-muted">{statusLabel[order.status]}</td>
                  <td className="py-2 text-df-muted">{order.totalGross} zł</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-df-body text-df-muted">Brak zleceń.</p>}
      </section>
    </div>
  );
}
