import type { OrderStatus } from "../../../lib/db/generated/client";
import type { StudioDb } from "../../../lib/db/tenant";

// Maszyna stanów zlecenia (#31). Reguły są jawną tabelą, nie rozsianymi `if`ami.
// Operacje biorą `studioDb(studioId)` po `authorizeStudio(..., "orders:update")`.

/** Etapy po stronie studia. Portal klienta składa je do 3 (etap 4 wchodzi w 3). */
export const ORDER_STAGES = {
  1: "Przyjęcie i mycie",
  2: "Korekta",
  3: "Ceramika",
  4: "Kontrola i odbiór",
} as const;
export const LAST_WORK_STAGE = 3;
export const FINAL_STAGE = 4;

export const ACTIVE_STATUSES = ["accepted", "in_progress", "ready_for_pickup"] as const satisfies readonly OrderStatus[];

/**
 * Dozwolone przejścia statusu. Z `accepted` nie ma drogi do `ready_for_pickup`
 * ani `completed` z pominięciem `in_progress`. `ready_for_pickup → in_progress`
 * to poprawka po kontroli. `completed` i `canceled` są końcowe.
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  accepted: ["in_progress", "canceled"],
  in_progress: ["ready_for_pickup", "canceled"],
  ready_for_pickup: ["completed", "in_progress"],
  completed: [],
  canceled: [],
};

/**
 * Etap musi pasować do statusu: przyjęte = 1, w trakcie = 1–3, do odbioru
 * i zakończone = 4. Anulowane zachowuje etap, na którym stanęło.
 */
export const STAGE_RANGE: Readonly<Record<OrderStatus, readonly [number, number]>> = {
  accepted: [1, 1],
  in_progress: [1, LAST_WORK_STAGE],
  ready_for_pickup: [FINAL_STAGE, FINAL_STAGE],
  completed: [FINAL_STAGE, FINAL_STAGE],
  canceled: [1, FINAL_STAGE],
};

export type OrderStateErrorCode = "not_found" | "invalid_transition" | "invalid_stage" | "conflict" | "not_invoiceable";

export class OrderStateError extends Error {
  override name = "OrderStateError";
  constructor(public code: OrderStateErrorCode, message: string) { super(message); }
}

export function allowedTransitions(from: OrderStatus): readonly OrderStatus[] {
  return ORDER_TRANSITIONS[from];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function isActiveStatus(status: OrderStatus): boolean {
  return (ACTIVE_STATUSES as readonly OrderStatus[]).includes(status);
}

export function isValidStage(status: OrderStatus, stage: number): boolean {
  const [min, max] = STAGE_RANGE[status];
  return Number.isInteger(stage) && stage >= min && stage <= max;
}

/** Zakończone zlecenie można fakturować; aktywne i anulowane nie. */
export function canInvoice(order: { status: OrderStatus; completedAt: Date | null }): boolean {
  return order.status === "completed" && order.completedAt !== null;
}

/** Etap po zmianie statusu. Cofnięcie z kontroli wraca na ostatni etap pracy. */
function stageAfter(from: OrderStatus, to: OrderStatus, stage: number): number {
  if (to === "ready_for_pickup" || to === "completed") return FINAL_STAGE;
  if (from === "ready_for_pickup" && to === "in_progress") return LAST_WORK_STAGE;
  return stage;
}

type OrderRow = { id: string; studioId: string; status: OrderStatus; stage: number };
type Change = { status: OrderStatus; stage: number; completedAt?: Date };

// Klient studia bez $transaction, więc kod działa też wewnątrz cudzej transakcji.
type Tx = Pick<StudioDb, "workOrder" | "workOrderEvent">;

/** Zapis zmiany + wpis w historii. Warunek `status`/`stage` w `where` odrzuca wyścig. */
async function applyChange(tx: Tx, order: OrderRow, next: Change, actorId: string | null) {
  const { count } = await tx.workOrder.updateMany({
    where: { id: order.id, status: order.status, stage: order.stage },
    data: next,
  });
  if (count === 0) throw new OrderStateError("conflict", "Zlecenie zostało w międzyczasie zmienione.");
  await tx.workOrderEvent.create({
    data: {
      studioId: order.studioId,
      workOrderId: order.id,
      fromStatus: order.status,
      toStatus: next.status,
      fromStage: order.stage,
      toStage: next.stage,
      actorId,
    },
  });
  return tx.workOrder.findFirstOrThrow({ where: { id: order.id } });
}

async function loadOrder(tx: Tx, orderId: string) {
  const order = await tx.workOrder.findFirst({ where: { id: orderId }, select: { id: true, studioId: true, status: true, stage: true } });
  if (!order) throw new OrderStateError("not_found", "Nie znaleziono zlecenia.");
  return order;
}

export type TransitionInput = { orderId: string; to: OrderStatus; actorId?: string | null; now?: Date };

/**
 * Zmiana statusu (przycisk, DnD na tablicy). Upuszczenie karty w tej samej
 * kolumnie nic nie zapisuje. Nielegalny skok → `invalid_transition`.
 */
export async function transitionOrder(db: StudioDb, { orderId, to, actorId = null, now = new Date() }: TransitionInput) {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (order.status === to) return tx.workOrder.findFirstOrThrow({ where: { id: orderId } });
    if (!canTransition(order.status, to)) {
      throw new OrderStateError("invalid_transition", `Zlecenie nie może przejść z ${order.status} do ${to}.`);
    }
    return applyChange(tx, order, {
      status: to,
      stage: stageAfter(order.status, to, order.stage),
      ...(to === "completed" ? { completedAt: now } : {}),
    }, actorId);
  });
}

/**
 * „Zakończ: [etap]”. W trakcie przesuwa o jeden etap; zakończenie ostatniego
 * etapu pracy (3) daje status „Do odbioru” i etap 4.
 */
export async function advanceStage(db: StudioDb, { orderId, actorId = null }: { orderId: string; actorId?: string | null }) {
  return db.$transaction(async (tx) => {
    const order = await loadOrder(tx, orderId);
    if (order.status !== "in_progress") {
      throw new OrderStateError("invalid_stage", "Etap można zmienić tylko w zleceniu w trakcie.");
    }
    if (order.stage >= LAST_WORK_STAGE) {
      return applyChange(tx, order, { status: "ready_for_pickup", stage: FINAL_STAGE }, actorId);
    }
    return applyChange(tx, order, { status: "in_progress", stage: order.stage + 1 }, actorId);
  });
}

/** Rzuca `not_invoiceable`, dopóki zlecenie nie jest zakończone. Wołać przed wystawieniem FV. */
export async function assertInvoiceable(db: Pick<StudioDb, "workOrder">, orderId: string) {
  const order = await db.workOrder.findFirst({ where: { id: orderId }, select: { status: true, completedAt: true } });
  if (!order) throw new OrderStateError("not_found", "Nie znaleziono zlecenia.");
  if (!canInvoice(order)) throw new OrderStateError("not_invoiceable", "Fakturę wystawia się po zakończeniu zlecenia.");
}

/** Historia do zakładki „Historia”, od najnowszej. */
export function listOrderHistory(db: Pick<StudioDb, "workOrderEvent">, orderId: string) {
  return db.workOrderEvent.findMany({
    where: { workOrderId: orderId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { actor: { select: { name: true } } },
  });
}

export const formatOrderNumber = (n: number) => `DF-${String(n).padStart(4, "0")}`;

/**
 * Następny numer DF-#### w studiu. Atomowy increment licznika, więc równoległe
 * zlecenia nie dostaną tego samego numeru. Brakujący licznik startuje od
 * najwyższego istniejącego numeru (migracja robi to samo dla istniejących studiów).
 * Wołać w transakcji tworzącej zlecenie, żeby przerwane tworzenie nie paliło numeru.
 */
export async function allocateOrderNumber(db: Pick<StudioDb, "orderCounter" | "workOrder">, studioId: string) {
  const existing = await db.orderCounter.findUnique({ where: { studioId } });
  if (!existing) {
    const numbers = await db.workOrder.findMany({ select: { number: true } });
    const highest = numbers.reduce((max, { number }) => Math.max(max, Number(/^DF-(\d+)$/.exec(number)?.[1] ?? 0)), 0);
    // skipDuplicates = ON CONFLICT DO NOTHING; w transakcji P2002 przerwałby całość.
    await db.orderCounter.createMany({ data: [{ studioId, last: highest }], skipDuplicates: true });
  }
  const { last } = await db.orderCounter.update({
    where: { studioId },
    data: { last: { increment: 1 } },
    select: { last: true },
  });
  return formatOrderNumber(last);
}
