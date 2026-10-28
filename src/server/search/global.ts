import type { MembershipRole } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { phoneVariants, plateVariants } from "../klienci/query";

export type GlobalSearchResult = {
  type: "client" | "vehicle" | "order" | "invoice";
  title: string;
  subtitle: string;
  href: string;
};

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
const hasInvoiceAccess = (role: MembershipRole) => role === "owner" || role === "manager";

/** Search operational records through the tenant-scoped DB. Workers never receive invoices. */
export async function searchStudio(studioId: string, rawQuery: string, role: MembershipRole): Promise<GlobalSearchResult[]> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length < 2) return [];

  const db = studioDb(studioId);
  const contains = { contains: escapeLike(query), mode: "insensitive" as const };
  const phones = phoneVariants(query).map((phone) => ({ contains: escapeLike(phone), mode: "insensitive" as const }));
  const plates = plateVariants(query).map((plate) => ({ contains: escapeLike(plate), mode: "insensitive" as const }));
  const [clients, vehicles, orders, invoices] = await Promise.all([
    db.client.findMany({
      where: { OR: [{ name: contains }, { email: contains }, ...phones.map((phone) => ({ phone }))] },
      orderBy: [{ name: "asc" }, { id: "asc" }], take: 4,
      select: { id: true, name: true, phone: true, email: true },
    }),
    db.vehicle.findMany({
      where: { OR: [...plates.map((plate) => ({ plate })), { plate: contains }, { make: contains }, { model: contains }, { client: { name: contains } }] },
      orderBy: [{ plate: "asc" }, { id: "asc" }], take: 4,
      select: { id: true, make: true, model: true, plate: true, client: { select: { id: true, name: true } } },
    }),
    db.workOrder.findMany({
      where: { OR: [
        { number: contains }, { service: contains }, { client: { name: contains } },
        ...plates.map((plate) => ({ vehicle: { plate } })),
        { vehicle: { plate: contains } }, { vehicle: { make: contains } }, { vehicle: { model: contains } },
      ] },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 4,
      select: { number: true, service: true, client: { select: { name: true } }, vehicle: { select: { make: true, model: true, plate: true } } },
    }),
    hasInvoiceAccess(role) ? db.invoice.findMany({
      where: { OR: [{ number: contains }, { buyerName: contains }, { buyerNip: contains }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 4,
      select: { number: true, buyerName: true, ksefEnv: true },
    }) : Promise.resolve([]),
  ]);

  return [
    ...clients.map((client) => ({
      type: "client" as const, title: client.name, subtitle: client.phone ?? client.email ?? "Klient",
      href: `/customers/${encodeURIComponent(client.id)}`,
    })),
    ...vehicles.map((vehicle) => ({
      type: "vehicle" as const, title: `${vehicle.make} ${vehicle.model}`.trim(), subtitle: `${vehicle.plate} · ${vehicle.client.name}`,
      href: `/customers/${encodeURIComponent(vehicle.client.id)}`,
    })),
    ...orders.map((order) => ({
      type: "order" as const, title: order.number,
      subtitle: `${order.service} · ${order.vehicle.make} ${order.vehicle.model} · ${order.client.name}`,
      href: `/orders/${encodeURIComponent(order.number)}`,
    })),
    ...invoices.map((invoice) => ({
      type: "invoice" as const, title: invoice.number, subtitle: `${invoice.buyerName} · ${invoice.ksefEnv === "test" ? "TEST" : "PROD"}`,
      href: `/invoices/${encodeURIComponent(invoice.number)}?env=${invoice.ksefEnv}`,
    })),
  ];
}

export function searchQueryFromUrl(url: string) {
  const query = new URL(url).searchParams.get("q") ?? "";
  return query.trim().slice(0, 100);
}
