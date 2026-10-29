import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError } from "../access-error";
import { TIME_ZONE, warsawDate } from "../pulpit/metrics";

/**
 * Statystyki studia (#144). Definicje metryk: docs/dokumentacja-wdrozenia.md §„Statystyki studia”.
 *
 * - Przychód = suma `WorkOrder.totalGross` (brutto PLN, Decimal) zleceń `completed`
 *   z `completedAt` w zakresie. Faktury, korekty i `Quote` nie są liczone osobno,
 *   więc nic nie liczy się dwa razy. To ta sama definicja co KPI pulpitu.
 * - Udział usług = podział tych samych zakończonych zleceń po etykiecie `WorkOrder.service`.
 *   Jedno zlecenie trafia dokładnie do jednej etykiety, więc udziały sumują się do 100%.
 * - Obłożenie = rezerwacje boksów (bez `canceled`) w oknie 08:00–16:00 Europe/Warsaw
 *   każdego dnia zakresu, bez podwójnego liczenia nakładających się rezerwacji.
 * - Brak źródłowych zdarzeń (zakończonych zleceń, rezerwacji, boksów) = „brak danych”, nie 0.
 */

export const MAX_RANGE_DAYS = 366;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 16;
const HOUR = 3_600_000;
const TOP_SERVICES = 8;

export type StatisticsRange = {
  /** Inclusive Warsaw calendar days, `YYYY-MM-DD`. */
  from: string;
  to: string;
  days: number;
  start: Date;
  /** Exclusive: Warsaw midnight after `to`. */
  end: Date;
};

type Ymd = { y: number; m: number; d: number };

const dayPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number, width = 2) => String(n).padStart(width, "0");
const format = ({ y, m, d }: Ymd) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

function parseDay(value: string): Ymd | null {
  const match = dayPattern.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const check = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2026-02-30 and similar overflow that Date.UTC would silently roll over.
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return y >= 2000 && y <= 2100 ? { y, m, d } : null;
}

/** Warsaw calendar date of an instant. */
export function warsawDay(instant: Date): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { y: part("year"), m: part("month"), d: part("day") };
}

function dayDiff(a: Ymd, b: Ymd) {
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

function shiftDay({ y, m, d }: Ymd, days: number): Ymd {
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function buildRange(from: Ymd, to: Ymd): StatisticsRange {
  const days = dayDiff(from, to) + 1;
  if (days < 1) throw new AccessError(400, "Data początkowa nie może być późniejsza niż końcowa.");
  if (days > MAX_RANGE_DAYS) throw new AccessError(400, `Zakres może obejmować najwyżej ${MAX_RANGE_DAYS} dni.`);
  return { from: format(from), to: format(to), days, start: warsawDate(from.y, from.m, from.d), end: warsawDate(to.y, to.m, to.d + 1) };
}

/** Both bounds are inclusive Warsaw days. Missing bounds default to the 1st of the current month … today. */
export function parseStatisticsRange(input: { from?: string | null; to?: string | null }, now = new Date()): StatisticsRange {
  const today = warsawDay(now);
  const from = input.from ? parseDay(input.from) : { ...today, d: 1 };
  const to = input.to ? parseDay(input.to) : today;
  if (!from || !to) throw new AccessError(400, "Podaj daty w formacie RRRR-MM-DD.");
  return buildRange(from, to);
}

export type StatisticsPresets = { label: string; from: string; to: string }[];

export function statisticsPresets(now = new Date()): StatisticsPresets {
  const today = warsawDay(now);
  const monthStart = { ...today, d: 1 };
  const previousStart = shiftDay(monthStart, -1);
  const previous = { ...previousStart, d: 1 };
  const threeMonthsAgo = { y: today.m > 2 ? today.y : today.y - 1, m: today.m > 2 ? today.m - 2 : today.m + 10, d: 1 };
  return [
    { label: "Ten miesiąc", from: format(monthStart), to: format(today) },
    { label: "Poprzedni miesiąc", from: format(previous), to: format(shiftDay(monthStart, -1)) },
    { label: "Ostatnie 3 miesiące", from: format(threeMonthsAgo), to: format(today) },
  ];
}

const D = (value: string | number | Prisma.Decimal) => new Prisma.Decimal(value);
const percent = (part: Prisma.Decimal, whole: Prisma.Decimal) => part.times(100).div(whole).toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP).toFixed(1);
const monthLabel = (y: number, m: number) => new Intl.DateTimeFormat("pl-PL", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1, 12)));

export type MonthRevenue = {
  key: string;
  label: string;
  /** Part of the month inside the selected range, inclusive Warsaw days. */
  from: string;
  to: string;
  partial: boolean;
  hasData: boolean;
  revenuePln: string | null;
  orders: number;
};
export type ServiceShare = { label: string; orders: number; orderShare: string; revenuePln: string; revenueShare: string | null };
export type BayOccupancy = { id: string; name: string; percent: string; bookedHours: number; capacityHours: number };
export type Statistics = {
  range: { from: string; to: string; days: number };
  revenue: { hasData: boolean; totalPln: string | null; orders: number; months: MonthRevenue[] };
  services: { hasData: boolean; orders: number; rows: ServiceShare[] };
  occupancy: { hasData: boolean; percent: string | null; bookedHours: number; capacityHours: number; windowLabel: string; bays: BayOccupancy[] };
};

function monthBuckets(range: StatisticsRange) {
  const first = parseDay(range.from)!;
  const last = parseDay(range.to)!;
  const buckets: { key: string; label: string; start: Date; end: Date; from: Ymd; to: Ymd; partial: boolean; orders: number; sum: Prisma.Decimal }[] = [];
  let y = first.y;
  let m = first.m;
  while (y < last.y || (y === last.y && m <= last.m)) {
    const monthFirst = { y, m, d: 1 };
    const monthLast = shiftDay({ y: m === 12 ? y + 1 : y, m: m === 12 ? 1 : m + 1, d: 1 }, -1);
    const from = dayDiff(first, monthFirst) > 0 ? monthFirst : first;
    const to = dayDiff(monthLast, last) > 0 ? monthLast : last;
    buckets.push({
      key: `${pad(y, 4)}-${pad(m)}`, label: monthLabel(y, m),
      start: warsawDate(y, m, 1), end: warsawDate(y, m + 1, 1),
      from, to, partial: format(from) !== format(monthFirst) || format(to) !== format(monthLast),
      orders: 0, sum: D(0),
    });
    if (m === 12) { y += 1; m = 1; } else m += 1;
  }
  return buckets;
}

const normalizeLabel = (service: string) => service.replace(/\s+/g, " ").trim();

/** Union of half-open intervals of one bay, sorted. Overlapping bookings count once. */
function mergeIntervals(intervals: [number, number][]) {
  const sorted = intervals.filter(([from, to]) => to > from).sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

/** Working window 08–16 Warsaw of every day in the range; identical for all bays, so computed once. */
function workingWindows(range: StatisticsRange) {
  const first = parseDay(range.from)!;
  return Array.from({ length: range.days }, (_, day) => [
    warsawDate(first.y, first.m, first.d + day, OPEN_HOUR).getTime(),
    warsawDate(first.y, first.m, first.d + day, CLOSE_HOUR).getTime(),
  ] as const);
}

function bookedMs(merged: [number, number][], windows: ReturnType<typeof workingWindows>) {
  let total = 0;
  let cursor = 0;
  for (const [windowStart, windowEnd] of windows) {
    while (cursor < merged.length && merged[cursor]![1] <= windowStart) cursor++;
    for (let i = cursor; i < merged.length && merged[i]![0] < windowEnd; i++) {
      total += Math.max(0, Math.min(windowEnd, merged[i]![1]) - Math.max(windowStart, merged[i]![0]));
    }
  }
  return total;
}

const roundHours = (ms: number) => Math.round((ms / HOUR) * 10) / 10;

export async function getStudioStatistics(studioId: string, range: StatisticsRange): Promise<Statistics> {
  const db = studioDb(studioId);
  const [completed, bays, bookings] = await Promise.all([
    db.workOrder.findMany({
      where: { status: "completed", completedAt: { gte: range.start, lt: range.end } },
      select: { completedAt: true, totalGross: true, service: true },
      orderBy: [{ completedAt: "asc" }, { id: "asc" }],
    }),
    db.bay.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }], select: { id: true, name: true } }),
    db.workOrder.findMany({
      where: { status: { not: "canceled" }, bayId: { not: null }, scheduledFrom: { lt: range.end }, scheduledTo: { gt: range.start } },
      select: { bayId: true, scheduledFrom: true, scheduledTo: true },
    }),
  ]);

  const buckets = monthBuckets(range);
  let total = D(0);
  const services = new Map<string, { label: string; orders: number; sum: Prisma.Decimal }>();
  for (const order of completed) {
    const at = order.completedAt!.getTime();
    const bucket = buckets.find((b) => at >= b.start.getTime() && at < b.end.getTime())!;
    bucket.orders += 1;
    bucket.sum = bucket.sum.plus(order.totalGross);
    total = total.plus(order.totalGross);
    const label = normalizeLabel(order.service) || "Bez nazwy usługi";
    const key = label.toLocaleLowerCase("pl");
    const entry = services.get(key) ?? { label, orders: 0, sum: D(0) };
    entry.orders += 1;
    entry.sum = entry.sum.plus(order.totalGross);
    services.set(key, entry);
  }

  const ranked = [...services.values()].sort((a, b) => b.orders - a.orders || b.sum.comparedTo(a.sum) || a.label.localeCompare(b.label, "pl"));
  const head = ranked.slice(0, TOP_SERVICES);
  const tail = ranked.slice(TOP_SERVICES);
  const rows = [...head, ...(tail.length ? [{ label: "Pozostałe usługi", orders: tail.reduce((n, e) => n + e.orders, 0), sum: tail.reduce((s, e) => s.plus(e.sum), D(0)) }] : [])];
  const orderCount = completed.length;

  const capacityMs = bays.length * range.days * (CLOSE_HOUR - OPEN_HOUR) * HOUR;
  const byBay = new Map<string, [number, number][]>();
  for (const booking of bookings) {
    const list = byBay.get(booking.bayId!) ?? [];
    list.push([booking.scheduledFrom.getTime(), booking.scheduledTo.getTime()]);
    byBay.set(booking.bayId!, list);
  }
  const occupancyHasData = bays.length > 0 && bookings.length > 0;
  const windows = workingWindows(range);
  let bookedTotal = 0;
  const bayRows = bays.map((bay) => {
    const booked = bookedMs(mergeIntervals(byBay.get(bay.id) ?? []), windows);
    bookedTotal += booked;
    const capacity = range.days * (CLOSE_HOUR - OPEN_HOUR) * HOUR;
    return { id: bay.id, name: bay.name, percent: percent(D(booked), D(capacity)), bookedHours: roundHours(booked), capacityHours: roundHours(capacity) };
  });

  return {
    range: { from: range.from, to: range.to, days: range.days },
    revenue: {
      hasData: orderCount > 0,
      totalPln: orderCount > 0 ? total.toFixed(2) : null,
      orders: orderCount,
      months: buckets.map((b) => ({
        key: b.key, label: b.label, from: format(b.from), to: format(b.to), partial: b.partial,
        hasData: b.orders > 0, revenuePln: b.orders > 0 ? b.sum.toFixed(2) : null, orders: b.orders,
      })),
    },
    services: {
      hasData: orderCount > 0,
      orders: orderCount,
      rows: rows.map((row) => ({
        label: row.label,
        orders: row.orders,
        orderShare: percent(D(row.orders), D(orderCount)),
        revenuePln: row.sum.toFixed(2),
        revenueShare: total.gt(0) ? percent(row.sum, total) : null,
      })),
    },
    occupancy: {
      hasData: occupancyHasData,
      percent: occupancyHasData ? percent(D(bookedTotal), D(capacityMs)) : null,
      bookedHours: roundHours(bookedTotal),
      capacityHours: roundHours(capacityMs),
      windowLabel: `${pad(OPEN_HOUR)}:00–${pad(CLOSE_HOUR)}:00`,
      bays: occupancyHasData ? bayRows : [],
    },
  };
}
