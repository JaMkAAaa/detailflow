/** D-02, UI-only scenario: 24 October 2026, 11:30. No operational queries. */
export type Booking = {
  id: string; number?: string; bay: number; from?: string; to?: string; employee: string; assigneeId?: string | null; vehicle: string; service: string;
  customer: string; start: number; end: number; status: "in-progress" | "scheduled";
};
export const bookings: Booking[] = [
  { id: "DF-0248", bay: 1, employee: "Michał", vehicle: "Porsche Panamera", service: "Korekta lakieru + ceramika", customer: "Adam Nowak", start: 480, end: 780, status: "in-progress" },
  { id: "DF-0250", bay: 1, employee: "Michał", vehicle: "BMW M4", service: "Detailing wnętrza", customer: "Tomasz Lis", start: 780, end: 960, status: "scheduled" },
  { id: "DF-0249", bay: 2, employee: "Kamil", vehicle: "Audi Q5", service: "Pakiet premium", customer: "Anna Wiśniewska", start: 510, end: 720, status: "in-progress" },
  { id: "DF-0251", bay: 2, employee: "Kamil", vehicle: "Mercedes C", service: "Mycie detailingowe", customer: "Jakub Wójcik", start: 810, end: 960, status: "scheduled" },
];
/** Wartość filtra „Nieprzypisane” (brak członka na zleceniu). */
export const UNASSIGNED = "__unassigned";

/**
 * Filtr osób D-02. Tryb live porównuje `assigneeId` (userId członka studia), demo — imię z makiety.
 * Pusty filtr = wszystkie; `UNASSIGNED` = zlecenia bez przypisanego członka.
 */
export function matchesEmployee(event: Booking, filter: string, live: boolean) {
  if (!filter) return true;
  if (filter === UNASSIGNED) return !event.assigneeId && (live || !event.employee);
  return live ? event.assigneeId === filter : event.employee === filter;
}

export function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Interval partitioning: connected overlap groups share a column count. */
export function layoutBookings(items: Booking[]) {
  const result: { booking: Booking; lane: number; lanes: number }[] = [];
  let group: typeof result = [];
  let ends: number[] = [];
  let groupEnd = -1;
  function flush() {
    group.forEach((item) => { item.lanes = ends.length; result.push(item); });
    group = []; ends = [];
  }
  for (const booking of [...items].sort((a, b) => a.start - b.start || a.end - b.end)) {
    if (booking.start >= groupEnd) flush();
    let lane = ends.findIndex((end) => end <= booking.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = booking.end;
    group.push({ booking, lane, lanes: 1 });
    groupEnd = Math.max(group.length === 1 ? -1 : groupEnd, booking.end);
  }
  flush();
  return result;
}

/** Trasa karty zlecenia: numer (`DF-0248`), gdy znany; w scenariuszu demo `id` jest numerem. */
export const bookingHref = (booking: Booking) => `/orders/${booking.number ?? booking.id}`;

/**
 * Rezerwacje widoczne danego dnia (`YYYY-MM-DD`) z minutami przycięte do osi 08:00–18:00.
 * Tryb demo ma jeden dzień ze stałymi minutami; tryb live liczy je z `from`/`to` (czas Warszawy).
 */
export function bookingsOnDay(events: Booking[], key: string, { live, today }: { live: boolean; today: string }) {
  if (!live) return key === today ? events : [];
  return events
    .filter((event) => event.from!.slice(0, 10) <= key && event.to!.slice(0, 10) >= key)
    .map((event) => ({
      ...event,
      start: event.from!.slice(0, 10) < key ? 480 : Math.max(480, Number(event.from!.slice(11, 13)) * 60 + Number(event.from!.slice(14, 16))),
      end: event.to!.slice(0, 10) > key ? 1080 : Math.min(1080, Number(event.to!.slice(11, 13)) * 60 + Number(event.to!.slice(14, 16))),
    }))
    .filter((event) => event.start < event.end);
}

export const MIN_FREE_MINUTES = 60;

/**
 * Wolne okna jednego boksu *między* rezerwacjami (nie przed pierwszą ani po ostatniej), dłuższe
 * niż `MIN_FREE_MINUTES`. Dla dzisiejszego dnia pomija okna, które już się skończyły (`nowMinutes`).
 */
export function freeWindows(dayBookings: Booking[], bay: number, nowMinutes?: number) {
  const sorted = dayBookings.filter((booking) => booking.bay === bay).sort((a, b) => a.start - b.start);
  const windows: { start: number; end: number }[] = [];
  let busyUntil = sorted[0]?.end ?? 0;
  for (const booking of sorted.slice(1)) {
    if (booking.start - busyUntil >= MIN_FREE_MINUTES && (nowMinutes === undefined || booking.start > nowMinutes)) {
      windows.push({ start: busyUntil, end: booking.start });
    }
    busyUntil = Math.max(busyUntil, booking.end);
  }
  return windows;
}

/** 90 → „1,5 h”, 120 → „2 h”. */
export const formatDuration = (minutes: number) =>
  `${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 }).format(minutes / 60)} h`;
