import { z } from "zod";
import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";

export const BOOKING_TIME_ZONE = "Europe/Warsaw";
const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

/** Local input means Warsaw wall time. DST gaps/folds require an explicit offset. */
export function bookingDate(value: string): Date | null {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  const wall = new Date(`${value}Z`).getTime();
  if (!Number.isFinite(wall)) return null;
  const offsets = new Set<number>();
  for (const delta of [-86400000, 0, 86400000]) {
    const sample = new Date(wall + delta);
    const local = formatter.format(sample).replace(" ", "T");
    offsets.add(new Date(`${local}Z`).getTime() - Math.floor(sample.getTime() / 1000) * 1000);
  }
  const candidates = [...offsets].map((offset) => new Date(wall - offset)).filter((date) =>
    formatter.format(date).replace(" ", "T") === new Date(wall).toISOString().slice(0, 19),
  );
  return candidates.length === 1 ? candidates[0]! : null;
}

const dateSchema = z.iso.datetime({ local: true, offset: true }).transform((value, ctx) => {
  const date = bookingDate(value);
  if (!date) {
    ctx.addIssue({ code: "custom", message: "Nieprawidłowy lub niejednoznaczny czas Europe/Warsaw. Podaj offset UTC." });
    return z.NEVER;
  }
  return date;
});
export const bookingSchema = z.object({
  bayId: z.string().trim().min(1), scheduledFrom: dateSchema, scheduledTo: dateSchema,
}).strict().refine((value) => value.scheduledFrom < value.scheduledTo, {
  path: ["scheduledTo"], message: "Koniec rezerwacji musi być późniejszy niż początek.",
});

/** Half-open intervals: a booking ending at 12:00 allows the next at 12:00. */
export function overlaps(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date) {
  return aFrom < bTo && bFrom < aTo;
}

export class BookingError extends Error {
  constructor(public status: 404 | 409, message: string) { super(message); }
}
const select = {
  id: true, number: true, bayId: true, scheduledFrom: true, scheduledTo: true,
  status: true, service: true, vehicle: { select: { make: true, model: true } },
  client: { select: { name: true } },
} satisfies Prisma.WorkOrderSelect;

export async function listBookings(studioId: string) {
  return studioDb(studioId).workOrder.findMany({
    where: { bayId: { not: null }, status: { not: "canceled" } },
    select, orderBy: [{ scheduledFrom: "asc" }, { id: "asc" }],
  });
}

export async function getBooking(studioId: string, workOrderId: string) {
  const booking = await studioDb(studioId).workOrder.findFirst({ where: { id: workOrderId, bayId: { not: null } }, select });
  if (!booking) throw new BookingError(404, "Nie znaleziono rezerwacji.");
  return booking;
}

export async function saveBooking(studioId: string, workOrderId: string, input: unknown, mode: "create" | "update") {
  const data = bookingSchema.parse(input);
  const db = studioDb(studioId);
  // Serializable predicate reads prevent write skew when two requests see an empty bay.
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const order = await tx.workOrder.findFirst({ where: { id: workOrderId }, select: { bayId: true, status: true } });
        if (!order || (mode === "update" && !order.bayId)) throw new BookingError(404, "Nie znaleziono rezerwacji lub zlecenia.");
        if (mode === "create" && order.bayId) throw new BookingError(409, "Zlecenie ma już rezerwację.");
        if (order.status === "canceled" || order.status === "completed") throw new BookingError(409, "Zlecenie jest zakończone lub anulowane.");
        if (!await tx.bay.findFirst({ where: { id: data.bayId }, select: { id: true } })) throw new BookingError(404, "Nie znaleziono boksu.");
        const collision = await tx.workOrder.findFirst({
          where: { id: { not: workOrderId }, bayId: data.bayId, status: { not: "canceled" },
            scheduledFrom: { lt: data.scheduledTo }, scheduledTo: { gt: data.scheduledFrom } },
          select: { id: true },
        });
        if (collision) throw new BookingError(409, "Boks jest zajęty w wybranym terminie.");
        return tx.workOrder.update({ where: { id: workOrderId }, data, select });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      // The pg adapter can surface a commit-time serialization failure directly.
      const adapterConflict = error instanceof Error && "cause" in error &&
        typeof error.cause === "object" && error.cause !== null &&
        "kind" in error.cause && error.cause.kind === "TransactionWriteConflict";
      if (adapterConflict || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034")) {
        if (attempt < 3) continue;
        throw new BookingError(409, "Grafik zmienił się podczas zapisu. Spróbuj ponownie.");
      }
      throw error;
    }
  }
}

/** Unassign the bay without deleting the order or its planned dates. */
export async function deleteBooking(studioId: string, workOrderId: string) {
  const result = await studioDb(studioId).workOrder.updateMany({
    where: { id: workOrderId, bayId: { not: null } }, data: { bayId: null },
  });
  if (!result.count) throw new BookingError(404, "Nie znaleziono rezerwacji.");
}
