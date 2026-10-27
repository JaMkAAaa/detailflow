import { DayGrid } from "@/components/kalendarz/DayGrid";
import { MobileDayView } from "@/components/kalendarz/MobileDayView";
import { BookingForm } from "@/components/kalendarz/BookingForm";
import { requireStudio } from "@/src/server/studio/context";
import { BOOKING_TIME_ZONE, listBookings } from "@/src/server/kalendarz/booking";

const localDate = (date: Date) => new Intl.DateTimeFormat("sv-SE", {
  timeZone: BOOKING_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
}).format(date).replace(" ", "T");

export default async function CalendarPage() {
  const { studioId, db } = await requireStudio();
  const [bays, reservations, orders] = await Promise.all([
    db.bay.findMany({ orderBy: { sort: "asc" }, select: { id: true, name: true, sort: true } }),
    listBookings(studioId),
    db.workOrder.findMany({ where: { status: { in: ["accepted", "in_progress", "ready_for_pickup"] } },
      select: { id: true, number: true, bayId: true, scheduledFrom: true, scheduledTo: true }, orderBy: { scheduledFrom: "asc" } }),
  ]);
  const now = localDate(new Date());
  const calendar = {
    bays, today: now.slice(0, 10), nowMinutes: Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16)),
    events: reservations.map((order) => ({
      id: order.id, number: order.number, bay: bays.find((bay) => bay.id === order.bayId)!.sort, employee: "",
      vehicle: `${order.vehicle.make} ${order.vehicle.model}`, customer: order.client.name, service: order.service,
      from: localDate(order.scheduledFrom), to: localDate(order.scheduledTo), start: 0, end: 0,
      status: order.status === "in_progress" ? "in-progress" as const : "scheduled" as const,
    })),
    reservationForm: <BookingForm studioId={studioId} bays={bays} orders={orders.map((order) => ({
      id: order.id, number: order.number, bayId: order.bayId, from: localDate(order.scheduledFrom), to: localDate(order.scheduledTo),
    }))} />,
  };
  // Oba układy dostają te same dane; CSS przełącza je na progu `lg` (jak M-01 na pulpicie).
  return <>
    <div className="lg:hidden"><MobileDayView {...calendar} /></div>
    <div className="hidden lg:block"><DayGrid {...calendar} /></div>
  </>;
}
