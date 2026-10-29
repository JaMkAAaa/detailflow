import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { AccessError } from "../acl";
import type { StudioDb } from "../../../lib/db/tenant";
import { assertAssignee, assertBayExists, assertBayFree, bookingDateSchema, serializableBooking } from "../kalendarz/booking";
import { allocateOrderNumber, OrderStateError } from "./state";
import { studioDb } from "../../../lib/db/tenant";
import { seedServices } from "../wyceny/catalog";

// Money crosses HTTP as a decimal string, never as a JSON floating-point number.
export const createOrderSchema = z.object({
  clientId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  service: z.string().trim().min(1).max(200),
  totalGross: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).transform((value) => new Prisma.Decimal(value)),
  scheduledFrom: bookingDateSchema,
  scheduledTo: bookingDateSchema,
  // Z okna kalendarza: boks tworzy rezerwację (kolizja → 409), pracownik jest opcjonalny.
  bayId: z.string().trim().min(1).optional(),
  assigneeId: z.string().trim().min(1).nullable().optional(),
}).strict().refine((value) => value.scheduledFrom < value.scheduledTo, {
  path: ["scheduledTo"], message: "Koniec musi być późniejszy niż początek.",
});

export const orderStatusSchema = z.object({
  status: z.enum(["accepted", "in_progress", "ready_for_pickup", "completed", "canceled"]),
}).strict();

export function listOrders(db: StudioDb) {
  return db.workOrder.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      vehicle: { select: { id: true, make: true, model: true, plate: true } },
      bay: { select: { name: true } },
      assignee: { select: { user: { select: { id: true, name: true } } } },
    },
  });
}

export async function getOrder(db: StudioDb, idOrNumber: string) {
  const order = await db.workOrder.findFirst({
    where: /^DF-\d{4,}$/.test(idOrNumber) ? { number: idOrNumber } : { id: idOrNumber },
    include: {
      client: { select: { id: true, name: true, phone: true, email: true } },
      vehicle: { select: { id: true, make: true, model: true, plate: true } },
      bay: { select: { name: true } },
      assignee: { select: { user: { select: { id: true, name: true } } } },
      quote: { include: { items: { orderBy: { sort: "asc" } } } },
      intake: { include: { damages: { orderBy: { no: "asc" } } } },
      photos: { orderBy: { no: "asc" } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { actor: { select: { name: true } } } },
    },
  });
  if (!order) throw new OrderStateError("not_found", "Nie znaleziono zlecenia.");
  return order;
}

/** Choices for the operational order form, scoped to the active studio. */
export async function loadOrderChoices(studioId: string) {
  await seedServices(studioId);
  const db = studioDb(studioId);
  const [clients, services] = await Promise.all([
    db.client.findMany({
      where: { vehicles: { some: {} } }, orderBy: { name: "asc" },
      include: { vehicles: { orderBy: { createdAt: "asc" }, select: { id: true, make: true, model: true, plate: true } } },
    }),
    db.service.findMany({ orderBy: [{ sort: "asc" }, { name: "asc" }] }),
  ]);
  return {
    clients: clients.map(({ id, name, vehicles }) => ({
      id, name, vehicles: vehicles.map((vehicle) => ({ id: vehicle.id, label: `${vehicle.make} ${vehicle.model} · ${vehicle.plate}` })),
    })),
    services: services.map(({ id, name, basePrice }) => ({ id, name, basePrice: basePrice.toFixed(2) })),
  };
}

export async function createOrder(db: StudioDb, studioId: string, actorId: string, input: unknown, quoteId?: string) {
  const data = createOrderSchema.parse(input);
  // Z boksem: Serializable chroni przed dwoma jednoczesnymi zapisami do tego samego wolnego okna.
  try {
    return await serializableBooking(db, async (tx) => {
      let snapshot: Partial<typeof data> & { quoteId?: string } = {};
      if (quoteId) {
        const quote = await tx.quote.findFirst({ where: { id: quoteId }, include: { items: { orderBy: { sort: "asc" } } } });
        if (!quote) throw new OrderStateError("not_found", "Nie znaleziono wyceny.");
        const existing = await tx.workOrder.findFirst({ where: { quoteId } });
        if (existing) return existing;
        if (quote.status !== "accepted") throw new AccessError(409, "Wycena nie jest zaakceptowana.");
        // Snapshot is authoritative; client-submitted price, client and vehicle cannot change it.
        snapshot = { quoteId, clientId: quote.clientId, vehicleId: quote.vehicleId,
          service: quote.items.map((item) => item.name).join(", "), totalGross: quote.totalGross };
      }
      const values = { ...data, ...snapshot };
      const client = await tx.client.findFirst({ where: { id: values.clientId }, select: { id: true } });
      const vehicle = await tx.vehicle.findFirst({ where: { id: values.vehicleId }, select: { clientId: true } });
      if (!client || !vehicle) throw new OrderStateError("not_found", "Nie znaleziono klienta lub auta.");
      if (vehicle.clientId !== client.id) throw new AccessError(400, "Auto nie należy do wybranego klienta.");
      if (data.bayId) {
        await assertBayExists(tx, data.bayId);
        await assertBayFree(tx, data.bayId, data.scheduledFrom, data.scheduledTo);
      }
      if (data.assigneeId) await assertAssignee(tx, data.assigneeId);
      const number = await allocateOrderNumber(tx, studioId);
      const order = await tx.workOrder.create({ data: { ...values, studioId, number, status: "accepted", stage: 1 } });
      await tx.workOrderEvent.create({ data: {
        studioId, workOrderId: order.id, actorId,
        fromStatus: null, fromStage: null, toStatus: "accepted", toStage: 1,
      } });
      return order;
    }, { serializable: quoteId !== undefined || data.bayId !== undefined });
  } catch (error) {
    // The unique (quoteId, studioId) index is the final guard against concurrent creates.
    if (quoteId && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.workOrder.findFirst({ where: { quoteId } });
      if (existing) return existing;
    }
    throw error;
  }
}
