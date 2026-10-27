import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb, type StudioDb } from "../../../lib/db/tenant";
import { parseClientCsv, type CsvRowError } from "./csv";
import { ClientError } from "./errors";
import { normalizeEmail, normalizePhone, normalizePlate } from "./plate";

export const PAGE_SIZE = 20;
const YEAR_MAX = new Date().getFullYear() + 1;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || null);

const optionalEmail = z.string().trim().toLowerCase().max(254).optional().nullable().transform((value, ctx) => {
  const email = value || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    ctx.addIssue({ code: "custom", message: "Nieprawidłowy e-mail." });
    return z.NEVER;
  }
  return email;
});

export const vehicleInputSchema = z.object({
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(80),
  plate: z.string().trim().min(1).max(16),
  year: z.number().int().min(1950).max(YEAR_MAX).optional().nullable(),
  color: optionalText(40),
  size: z.enum(["small", "medium", "suv"]).optional(),
}).strict();

export const clientCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: optionalEmail,
  phone: optionalText(32),
  street: optionalText(120),
  postal: optionalText(12),
  city: optionalText(80),
  nip: optionalText(20),
  isRegular: z.boolean().optional(),
  vehicle: vehicleInputSchema.optional(),
}).strict();

export const clientUpdateSchema = clientCreateSchema.omit({ vehicle: true }).partial().strict()
  .refine((value) => Object.keys(value).length > 0, "Brak danych do zapisu.");

export const vehicleCreateSchema = vehicleInputSchema;
export const vehicleUpdateSchema = vehicleInputSchema.partial().extend({
  clientId: z.string().trim().min(1).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Brak danych do zapisu.");

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  q: z.string().trim().max(120).default(""),
});

export type DuplicatePlateWarning = {
  code: "duplicate_plate";
  plate: string;
  existing: { vehicleId: string; clientId: string; clientName: string; plate: string }[];
};

const clientCard = {
  id: true, name: true, email: true, phone: true, street: true, postal: true, city: true,
  nip: true, isRegular: true, createdAt: true,
  vehicles: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, make: true, model: true, plate: true, year: true, color: true, size: true, createdAt: true },
  },
} satisfies Prisma.ClientSelect;

const vehicleRow = {
  id: true, clientId: true, make: true, model: true, plate: true, year: true, color: true, size: true, createdAt: true,
} satisfies Prisma.VehicleSelect;

type Tx = Parameters<Parameters<StudioDb["$transaction"]>[0]>[0];

async function plateDuplicates(db: StudioDb | Tx, plate: string, exceptVehicleId?: string) {
  const key = normalizePlate(plate);
  if (!key) return [];
  const vehicles = await db.vehicle.findMany({
    select: { id: true, clientId: true, plate: true, client: { select: { name: true } } },
  });
  return vehicles.filter((vehicle) => vehicle.id !== exceptVehicleId && normalizePlate(vehicle.plate) === key);
}

function duplicateWarning(plate: string, existing: Awaited<ReturnType<typeof plateDuplicates>>): DuplicatePlateWarning | null {
  if (!existing.length) return null;
  return {
    code: "duplicate_plate",
    plate,
    existing: existing.map((vehicle) => ({
      vehicleId: vehicle.id, clientId: vehicle.clientId, clientName: vehicle.client.name, plate: vehicle.plate,
    })),
  };
}

function searchWhere(q: string): Prisma.ClientWhereInput {
  if (!q) return {};
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      { vehicles: { some: { OR: [
        { plate: { contains: q, mode: "insensitive" } },
        { make: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ] } } },
    ],
  };
}

export function parseListQuery(url: string) {
  const { searchParams } = new URL(url);
  return listQuerySchema.parse({
    page: searchParams.get("page") || undefined,
    q: searchParams.get("q") ?? undefined,
  });
}

/** Lista klientów: 20 wierszy w SQL (`take`/`skip`), nie po stronie klienta. */
export async function listClients(studioId: string, query: { page?: number; q?: string } = {}) {
  const { page, q } = listQuerySchema.parse(query);
  const db = studioDb(studioId);
  const where = searchWhere(q);
  const [total, vehicleTotal, items] = await Promise.all([
    db.client.count({ where }),
    db.vehicle.count(),
    db.client.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        ...clientCard,
        orders: { orderBy: { scheduledFrom: "desc" }, take: 1, select: { number: true, scheduledFrom: true, status: true } },
      },
    }),
  ]);
  return { items, total, page, pageSize: PAGE_SIZE, vehicleTotal };
}

export async function getClient(studioId: string, clientId: string) {
  const client = await studioDb(studioId).client.findFirst({
    where: { id: clientId },
    select: {
      ...clientCard,
      orders: {
        orderBy: { scheduledFrom: "desc" },
        select: {
          id: true, number: true, status: true, service: true, stage: true,
          scheduledFrom: true, scheduledTo: true, completedAt: true, totalGross: true,
          vehicle: { select: { plate: true, make: true, model: true } },
        },
      },
    },
  });
  if (!client) throw new ClientError(404, "Nie znaleziono klienta.");
  return {
    ...client,
    orders: client.orders.map((order) => ({ ...order, totalGross: order.totalGross.toFixed(2) })),
  };
}

export async function createClient(studioId: string, input: unknown) {
  const data = clientCreateSchema.parse(input);
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        studioId, name: data.name, email: data.email, phone: data.phone, street: data.street,
        postal: data.postal, city: data.city, nip: data.nip, isRegular: data.isRegular ?? false,
      },
      select: clientCard,
    });
    if (!data.vehicle) return { ...client, vehicles: [], warnings: [] as DuplicatePlateWarning[] };
    const existing = await plateDuplicates(tx, data.vehicle.plate);
    const vehicle = await tx.vehicle.create({
      data: { studioId, clientId: client.id, ...data.vehicle, size: data.vehicle.size ?? "medium" },
      select: vehicleRow,
    });
    const warning = duplicateWarning(data.vehicle.plate, existing);
    return { ...client, vehicles: [vehicle], warnings: warning ? [warning] : [] };
  });
}

export async function updateClient(studioId: string, clientId: string, input: unknown) {
  const data = clientUpdateSchema.parse(input);
  const db = studioDb(studioId);
  const result = await db.client.updateMany({ where: { id: clientId }, data });
  if (!result.count) throw new ClientError(404, "Nie znaleziono klienta.");
  return getClient(studioId, clientId);
}

async function assertDeletable(db: StudioDb, where: { clientId: string } | { vehicleId: string }) {
  const [orders, quotes] = await Promise.all([
    db.workOrder.count({ where }),
    db.quote.count({ where }),
  ]);
  return orders === 0 && quotes === 0;
}

export async function deleteClient(studioId: string, clientId: string) {
  const db = studioDb(studioId);
  if (!await db.client.findFirst({ where: { id: clientId }, select: { id: true } })) {
    throw new ClientError(404, "Nie znaleziono klienta.");
  }
  if (!await assertDeletable(db, { clientId })) {
    throw new ClientError(409, "Nie można usunąć klienta z historią zleceń lub wycen.");
  }
  await db.$transaction([
    db.vehicle.deleteMany({ where: { clientId } }),
    db.client.deleteMany({ where: { id: clientId } }),
  ]);
}

export async function createVehicle(studioId: string, clientId: string, input: unknown) {
  const data = vehicleCreateSchema.parse(input);
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    if (!await tx.client.findFirst({ where: { id: clientId }, select: { id: true } })) {
      throw new ClientError(404, "Nie znaleziono klienta.");
    }
    const existing = await plateDuplicates(tx, data.plate);
    const vehicle = await tx.vehicle.create({
      data: { studioId, clientId, ...data, size: data.size ?? "medium" },
      select: vehicleRow,
    });
    const warning = duplicateWarning(data.plate, existing);
    return { ...vehicle, warnings: warning ? [warning] : [] };
  });
}

export async function updateVehicle(studioId: string, vehicleId: string, input: unknown) {
  const data = vehicleUpdateSchema.parse(input);
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const current = await tx.vehicle.findFirst({ where: { id: vehicleId }, select: { id: true, plate: true } });
    if (!current) throw new ClientError(404, "Nie znaleziono auta.");
    if (data.clientId && !await tx.client.findFirst({ where: { id: data.clientId }, select: { id: true } })) {
      throw new ClientError(404, "Nie znaleziono klienta.");
    }
    const plate = data.plate ?? current.plate;
    const existing = await plateDuplicates(tx, plate, vehicleId);
    const vehicle = await tx.vehicle.update({ where: { id: vehicleId }, data, select: vehicleRow });
    const warning = duplicateWarning(plate, existing);
    return { ...vehicle, warnings: warning ? [warning] : [] };
  });
}

export async function deleteVehicle(studioId: string, vehicleId: string) {
  const db = studioDb(studioId);
  if (!await db.vehicle.findFirst({ where: { id: vehicleId }, select: { id: true } })) {
    throw new ClientError(404, "Nie znaleziono auta.");
  }
  if (!await assertDeletable(db, { vehicleId })) {
    throw new ClientError(409, "Nie można usunąć auta z historią zleceń lub wycen.");
  }
  await db.vehicle.deleteMany({ where: { id: vehicleId } });
}

export type ImportResult = {
  createdClients: number;
  createdVehicles: number;
  unchanged: number;
  invalid: number;
  errors: CsvRowError[];
  warnings: (DuplicatePlateWarning & { row: number })[];
};

/**
 * Import CSV w obrębie jednego `studioId`. Ten sam e-mail/telefon w innym
 * studiu to inny klient. Ponowny import tego samego pliku nic nie dopisuje.
 */
export async function importClientsCsv(studioId: string, csv: string) {
  const parsed = parseClientCsv(csv);
  const db = studioDb(studioId);
  return db.$transaction(async (tx) => {
    const [clients, vehicles] = await Promise.all([
      tx.client.findMany({ select: { id: true, email: true, phone: true } }),
      tx.vehicle.findMany({ select: { id: true, clientId: true, plate: true, client: { select: { name: true } } } }),
    ]);
    const byEmail = new Map<string, string>();
    const byPhone = new Map<string, string>();
    for (const client of clients) {
      const email = normalizeEmail(client.email);
      const phone = normalizePhone(client.phone);
      if (email && !byEmail.has(email)) byEmail.set(email, client.id);
      if (phone && !byPhone.has(phone)) byPhone.set(phone, client.id);
    }
    const plates = vehicles.map((vehicle) => ({
      id: vehicle.id, clientId: vehicle.clientId, plate: vehicle.plate, key: normalizePlate(vehicle.plate),
      clientName: vehicle.client.name,
    }));

    const result: ImportResult = {
      createdClients: 0, createdVehicles: 0, unchanged: 0, invalid: parsed.errors.length,
      errors: [...parsed.errors], warnings: [],
    };

    for (const row of parsed.rows) {
      const emailKey = normalizeEmail(row.email);
      const phoneKey = normalizePhone(row.phone);
      let clientId = (emailKey && byEmail.get(emailKey)) || (phoneKey && byPhone.get(phoneKey)) || null;
      if (!clientId) {
        const created = await tx.client.create({
          data: { studioId, name: row.name, email: row.email, phone: row.phone },
          select: { id: true },
        });
        clientId = created.id;
        if (emailKey) byEmail.set(emailKey, clientId);
        if (phoneKey) byPhone.set(phoneKey, clientId);
        result.createdClients += 1;
      }

      const key = normalizePlate(row.plate);
      const sameClientPlate = plates.find((vehicle) => vehicle.clientId === clientId && vehicle.key === key);
      if (sameClientPlate) {
        result.unchanged += 1;
        continue;
      }
      const others = plates.filter((vehicle) => vehicle.key === key);
      const created = await tx.vehicle.create({
        data: { studioId, clientId, make: row.make, model: row.model, plate: row.plate },
        select: { id: true },
      });
      plates.push({ id: created.id, clientId, plate: row.plate, key, clientName: row.name });
      result.createdVehicles += 1;
      if (others.length) {
        result.warnings.push({
          row: row.row, code: "duplicate_plate", plate: row.plate,
          existing: others.map((vehicle) => ({
            vehicleId: vehicle.id, clientId: vehicle.clientId, clientName: vehicle.clientName, plate: vehicle.plate,
          })),
        });
      }
    }
    return result;
  });
}
