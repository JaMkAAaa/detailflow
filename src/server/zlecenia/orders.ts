import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { AccessError } from "../acl";
import type { StudioDb } from "../../../lib/db/tenant";
import { bookingDateSchema } from "../kalendarz/booking";
import { allocateOrderNumber, OrderStateError } from "./state";

// Money crosses HTTP as a decimal string, never as a JSON floating-point number.
export const createOrderSchema = z.object({
  clientId: z.string().trim().min(1),
  vehicleId: z.string().trim().min(1),
  service: z.string().trim().min(1).max(200),
  totalGross: z.string().regex(/^\d{1,10}(?:\.\d{1,2})?$/).transform((value) => new Prisma.Decimal(value)),
  scheduledFrom: bookingDateSchema,
  scheduledTo: bookingDateSchema,
}).strict().refine((value) => value.scheduledFrom < value.scheduledTo, {
  path: ["scheduledTo"], message: "Koniec musi być późniejszy niż początek.",
});

export const orderStatusSchema = z.object({
  status: z.enum(["accepted", "in_progress", "ready_for_pickup", "completed", "canceled"]),
}).strict();

export function listOrders(db: StudioDb) {
  return db.workOrder.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

export async function getOrder(db: StudioDb, idOrNumber: string) {
  const order = await db.workOrder.findFirst({
    where: /^DF-\d{4,}$/.test(idOrNumber) ? { number: idOrNumber } : { id: idOrNumber },
  });
  if (!order) throw new OrderStateError("not_found", "Nie znaleziono zlecenia.");
  return order;
}

export async function createOrder(db: StudioDb, studioId: string, actorId: string, input: unknown) {
  const data = createOrderSchema.parse(input);
  return db.$transaction(async (tx) => {
    const client = await tx.client.findFirst({ where: { id: data.clientId }, select: { id: true } });
    const vehicle = await tx.vehicle.findFirst({ where: { id: data.vehicleId }, select: { clientId: true } });
    if (!client || !vehicle) throw new OrderStateError("not_found", "Nie znaleziono klienta lub auta.");
    if (vehicle.clientId !== client.id) throw new AccessError(400, "Auto nie należy do wybranego klienta.");
    const number = await allocateOrderNumber(tx, studioId);
    const order = await tx.workOrder.create({ data: { ...data, studioId, number, status: "accepted", stage: 1 } });
    await tx.workOrderEvent.create({ data: {
      studioId, workOrderId: order.id, actorId,
      fromStatus: null, fromStage: null, toStatus: "accepted", toStage: 1,
    } });
    return order;
  });
}
