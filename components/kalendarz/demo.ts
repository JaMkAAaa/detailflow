/** D-02, UI-only scenario: 24 October 2026, 11:30. No operational queries. */
export type Booking = {
  id: string; bay: 1 | 2; employee: string; vehicle: string; service: string;
  customer: string; start: number; end: number; status: "in-progress" | "scheduled";
};
export const bookings: Booking[] = [
  { id: "DF-0248", bay: 1, employee: "Michał", vehicle: "Porsche Panamera", service: "Korekta lakieru + ceramika", customer: "Adam Nowak", start: 480, end: 780, status: "in-progress" },
  { id: "DF-0250", bay: 1, employee: "Michał", vehicle: "BMW M4", service: "Detailing wnętrza", customer: "Tomasz Lis", start: 780, end: 960, status: "scheduled" },
  { id: "DF-0249", bay: 2, employee: "Kamil", vehicle: "Audi Q5", service: "Pakiet premium", customer: "Anna Wiśniewska", start: 510, end: 720, status: "in-progress" },
  { id: "DF-0251", bay: 2, employee: "Kamil", vehicle: "Mercedes C", service: "Mycie detailingowe", customer: "Jakub Wójcik", start: 810, end: 960, status: "scheduled" },
];
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
