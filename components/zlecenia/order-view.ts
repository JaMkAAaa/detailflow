import type { BoardOrder, OrderStatus } from "./board-demo";
import type { HistoryEvent, OrderDetailsData, OrderStage } from "./order-types";

export type ApiWorkOrder = {
  id: string;
  number: string;
  clientId: string;
  vehicleId: string;
  service: string;
  status: OrderStatus;
  stage: number;
  totalGross: string | number | { toString(): string };
  scheduledFrom: string | Date;
  scheduledTo: string | Date;
  dueAt?: string | Date | null;
  completedAt?: string | Date | null;
  client: { id: string; name: string; phone: string | null; email: string | null };
  vehicle: { id: string; make: string; model: string; plate: string };
  bay: { name: string } | null;
  quote?: { status: string; totalGross?: string | number | { toString(): string }; items?: { name: string; basePrice: string | number | { toString(): string } }[] } | null;
  intake?: { number: string; createdAt: string | Date; acceptedAt: string | Date | null; createdBy?: { name: string | null } | null; damages: { no: number; title: string; part: string; size: string | null; posX?: number; posY?: number; photoId: string | null }[] } | null;
  photos?: { id: string; no: number; caption: string | null; stage: number; uploadedAt: string | Date | null }[];
  events?: { createdAt: string | Date; fromStatus: OrderStatus | null; toStatus: OrderStatus; fromStage: number | null; toStage: number; actor: { name: string | null } | null }[];
};

const stageNames = ["Przyjęcie i mycie", "Korekta lakieru", "Aplikacja ceramiki", "Kontrola i odbiór"];
const statusLabels: Record<OrderStatus, string> = {
  accepted: "Przyjęte", in_progress: "W trakcie", ready_for_pickup: "Do odbioru", completed: "Zakończone", canceled: "Anulowane",
};
const quoteStatusLabels: Record<string, string> = { draft: "Szkic", sent: "Wysłana", accepted: "Zaakceptowana", rejected: "Odrzucona", expired: "Wygasła" };
const statusBadge = (status: OrderStatus) => status === "in_progress" ? "in-progress" : status === "ready_for_pickup" ? "ready-for-pickup" : status === "canceled" ? "error" : status;
const iso = (value: string | Date) => value instanceof Date ? value.toISOString() : value;
const money = (value: ApiWorkOrder["totalGross"]) => typeof value === "string" ? value : value.toString();
const labelTime = (value: string | Date) => new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw" }).format(new Date(value));

export function toBoardOrder(order: ApiWorkOrder): BoardOrder {
  const date = order.status === "completed" && order.completedAt ? order.completedAt : order.dueAt ?? order.scheduledTo;
  const prefix = order.status === "accepted" ? "Przyjazd" : order.status === "completed" ? "Odebrano" : order.status === "canceled" ? "Anulowano" : "Odbiór";
  return {
    id: order.id,
    clientId: order.client.id,
    number: order.number,
    vehicle: `${order.vehicle.make} ${order.vehicle.model}`.trim(),
    customer: order.client.name,
    plate: order.vehicle.plate,
    service: order.service,
    status: order.status,
    dueLabel: `${prefix}: ${labelTime(date)}`,
    grossPln: money(order.totalGross),
  };
}
function eventForOrder(event: NonNullable<ApiWorkOrder["events"]>[number]): HistoryEvent {
  const stageChanged = event.fromStage !== null && event.fromStage !== event.toStage;
  const statusChanged = event.fromStatus !== null && event.fromStatus !== event.toStatus;
  const title = stageChanged ? `Zmieniono etap: ${stageNames[event.toStage - 1] ?? `Etap ${event.toStage}`}`
    : statusChanged ? `Zmieniono status: ${statusLabels[event.toStatus]}`
      : `Utworzono zlecenie`;
  return {
    at: iso(event.createdAt),
    title,
    detail: stageChanged || statusChanged ? `${event.fromStatus ? statusLabels[event.fromStatus] : "Nowe"} → ${statusLabels[event.toStatus]}` : undefined,
    actor: event.actor?.name ?? "System",
    kind: event.actor?.name ? "studio" : "system",
  };
}

export function toOrderDetails(order: ApiWorkOrder): OrderDetailsData {
  const stages: OrderStage[] = stageNames.map((name, index) => {
    const number = index + 1;
    const state = order.status === "completed" ? "done" : number < order.stage ? "done" : number === order.stage ? "current" : "todo";
    const note = state === "done" ? "Etap zakończony" : state === "current" ? order.status === "canceled" ? "Zlecenie anulowane" : statusLabels[order.status] : "Oczekuje";
    return { name, note, state };
  });
  const total = money(order.totalGross);
  const intake = order.intake;
  const events = order.events ?? [];
  return {
    id: order.id,
    clientId: order.client.id,
    number: order.number,
    vehicle: `${order.vehicle.make} ${order.vehicle.model}`.trim(),
    plate: order.vehicle.plate,
    bay: order.bay?.name ?? "Bez przypisanego boksu",
    status: statusBadge(order.status),
    service: order.service,
    stages,
    customer: { id: order.client.id, name: order.client.name, phone: order.client.phone ?? "", email: order.client.email ?? "" },
    quote: {
      status: order.quote ? quoteStatusLabels[order.quote.status] ?? order.quote.status : "—",
      items: [{ name: order.service, grossPln: total }],
      totalGrossPln: total,
    },
    intake: {
      protocol: intake?.number ?? "",
      at: intake ? iso(intake.createdAt) : iso(order.scheduledFrom),
      by: intake?.createdBy?.name ?? "—",
      acceptedAt: intake?.acceptedAt ? iso(intake.acceptedAt) : "",
      damages: intake?.damages.map((damage) => ({
        no: damage.no, title: damage.title, part: damage.part, size: damage.size ?? "—",
        x: typeof damage.posX === "number" ? damage.posX : undefined,
        y: typeof damage.posY === "number" ? damage.posY : undefined,
        photoId: damage.photoId ?? undefined,
        photo: damage.photoId ? order.photos?.find((photo) => photo.id === damage.photoId)?.no : undefined,
      })) ?? [],
    },
    photos: (order.photos ?? []).filter((photo) => photo.uploadedAt).map((photo) => ({
      id: photo.id, no: photo.no, at: iso(photo.uploadedAt!), caption: photo.caption ?? `Zdjęcie ${photo.no}`,
      stage: stageNames[photo.stage - 1] ?? `Etap ${photo.stage}`,
    })),
    history: events.map(eventForOrder),
  };
}
