import { Prisma, type OrderStatus } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import {
  CLIENTS_PER_PAGE,
  phoneVariants,
  plateVariants,
  type ClientFilter,
  type ClientsQuery,
} from "./query";

const activeStatuses = ["accepted", "in_progress", "ready_for_pickup"] as const satisfies readonly OrderStatus[];
const money = (value: Prisma.Decimal | null | undefined) => (value ?? new Prisma.Decimal(0)).toFixed(2);

export type ClientRow = {
  id: string;
  name: string;
  phone: string | null;
  isRegular: boolean;
  plates: string[];
  lastVisit: Date | null;
  /** Suma brutto zleceń (bez anulowanych), PLN jako string z dwoma miejscami. */
  totalGross: string;
};

export type ClientVehicle = {
  id: string;
  make: string;
  model: string;
  plate: string;
  year: number | null;
  color: string | null;
  lastVisit: Date | null;
  active: { number: string; status: (typeof activeStatuses)[number] } | null;
};

export type ClientVisit = {
  number: string;
  at: Date;
  totalGross: string;
  service: string;
  status: OrderStatus;
  vehicle: string;
};

export type ClientProfile = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  isRegular: boolean;
  coatingService: boolean;
  since: Date;
  visitCount: number;
  vehicles: ClientVehicle[];
  visits: ClientVisit[];
};

export type ClientsPage = {
  query: ClientsQuery;
  rows: ClientRow[];
  /** Wyniki dla bieżącego filtra i wyszukiwania. */
  total: number;
  vehicleTotal: number;
  /** Liczniki chipów — całe studio, niezależnie od wyszukiwania. */
  counts: Record<ClientFilter, number>;
  page: number;
  pages: number;
  selected: ClientProfile | null;
};

const openCoating = { vehicles: { some: { coatingReminders: { some: { completedAt: null } } } } } satisfies Prisma.ClientWhereInput;

function clientWhere(filter: ClientFilter, q: string): Prisma.ClientWhereInput {
  const and: Prisma.ClientWhereInput[] = [];
  if (filter === "regular") and.push({ isRegular: true });
  if (filter === "coating") and.push(openCoating);
  if (q) {
    // Prisma nie escapuje wildcardów LIKE, więc „%” i „_” z pola wyszukiwania zrobiłyby „wszyscy”.
    const contains = (value: string) => ({ contains: value.replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const });
    and.push({
      OR: [
        { name: contains(q) },
        ...phoneVariants(q).map((phone) => ({ phone: contains(phone) })),
        ...plateVariants(q).map((plate) => ({ vehicles: { some: { plate: contains(plate) } } })),
      ],
    });
  }
  return { AND: and };
}

const byAge = [{ createdAt: "asc" }, { id: "asc" }] satisfies Prisma.ClientOrderByWithRelationInput[];

/**
 * Katalog klientów (D-05). Wszystkie zapytania idą przez `studioDb`, więc strona 2
 * i karta klienta nigdy nie widzą wierszy innego studia, nawet dla cudzego `?client=`.
 * Kolejność: od najdłużej współpracujących; stabilna dzięki `id`.
 */
export async function listClients(studioId: string, query: ClientsQuery, now = new Date()): Promise<ClientsPage> {
  const db = studioDb(studioId);
  const where = clientWhere(query.filter, query.q);

  const [total, vehicleTotal, all, regular, coating] = await Promise.all([
    db.client.count({ where }),
    db.vehicle.count({ where: { client: where } }),
    db.client.count(),
    db.client.count({ where: { isRegular: true } }),
    db.client.count({ where: openCoating }),
  ]);

  const pages = Math.max(1, Math.ceil(total / CLIENTS_PER_PAGE));
  const page = Math.min(query.page, pages);
  const clients = await db.client.findMany({
    where,
    orderBy: byAge,
    skip: (page - 1) * CLIENTS_PER_PAGE,
    take: CLIENTS_PER_PAGE,
    select: {
      id: true,
      name: true,
      phone: true,
      isRegular: true,
      vehicles: { orderBy: byAge, select: { plate: true } },
    },
  });

  const ids = clients.map((client) => client.id);
  const [totals, visits] = await Promise.all([
    db.workOrder.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: { not: "canceled" } },
      _sum: { totalGross: true },
    }),
    // „Ostatnia wizyta” to ostatnie rozpoczęte zlecenie; przyszła rezerwacja nią nie jest.
    db.workOrder.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids }, status: { not: "canceled" }, scheduledFrom: { lte: now } },
      _max: { scheduledFrom: true },
    }),
  ]);
  const totalBy = new Map(totals.map((row) => [row.clientId, row._sum.totalGross]));
  const visitBy = new Map(visits.map((row) => [row.clientId, row._max.scheduledFrom]));

  const rows = clients.map((client) => ({
    id: client.id,
    name: client.name,
    phone: client.phone,
    isRegular: client.isRegular,
    plates: client.vehicles.map((vehicle) => vehicle.plate),
    lastVisit: visitBy.get(client.id) ?? null,
    totalGross: money(totalBy.get(client.id)),
  }));

  const selected =
    (query.client ? await getClientProfile(studioId, query.client, now) : null) ??
    (rows[0] ? await getClientProfile(studioId, rows[0].id, now) : null);

  return { query: { ...query, page }, rows, total, vehicleTotal, counts: { all, regular, coating }, page, pages, selected };
}

/** Karta klienta: auta z ostatnią wizytą i aktywnym zleceniem + trzy ostatnie wizyty. */
export async function getClientProfile(studioId: string, clientId: string, now = new Date()): Promise<ClientProfile | null> {
  const db = studioDb(studioId);
  const client = await db.client.findFirst({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      isRegular: true,
      createdAt: true,
      vehicles: {
        orderBy: byAge,
        select: { id: true, make: true, model: true, plate: true, year: true, color: true },
      },
      orders: {
        where: { status: { not: "canceled" } },
        orderBy: [{ scheduledFrom: "desc" }, { number: "desc" }],
        select: {
          number: true,
          status: true,
          service: true,
          scheduledFrom: true,
          totalGross: true,
          vehicleId: true,
          vehicle: { select: { make: true, model: true } },
        },
      },
    },
  });
  if (!client) return null;

  const coating = await db.coatingReminder.count({ where: { completedAt: null, vehicle: { clientId: client.id } } });

  return {
    id: client.id,
    name: client.name,
    phone: client.phone,
    email: client.email,
    isRegular: client.isRegular,
    coatingService: coating > 0,
    since: client.createdAt,
    visitCount: client.orders.length,
    vehicles: client.vehicles.map((vehicle) => {
      const own = client.orders.filter((order) => order.vehicleId === vehicle.id);
      const running = own.find((order) => (activeStatuses as readonly OrderStatus[]).includes(order.status));
      return {
        ...vehicle,
        lastVisit: own.find((order) => order.scheduledFrom <= now)?.scheduledFrom ?? null,
        active: running ? { number: running.number, status: running.status as (typeof activeStatuses)[number] } : null,
      };
    }),
    visits: client.orders.slice(0, 3).map((order) => ({
      number: order.number,
      at: order.scheduledFrom,
      totalGross: money(order.totalGross),
      service: order.service,
      status: order.status,
      vehicle: `${order.vehicle.make} ${order.vehicle.model}`,
    })),
  };
}
