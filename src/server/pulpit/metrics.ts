import { Prisma } from "../../../lib/db/generated/client";
import { studioDb } from "../../../lib/db/tenant";

export const TIME_ZONE = "Europe/Warsaw";
const HOUR = 3_600_000;
const activeStatuses = ["accepted", "in_progress", "ready_for_pickup"] as const;

/** Warsaw wall time, including DST. Callers use unambiguous midnight/working hours. */
export function warsawDate(year: number, month: number, day: number, hour = 0) {
  const wall = Date.UTC(year, month - 1, day, hour);
  let instant = wall;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const n = (type: string) =>
      Number(parts.find((p) => p.type === type)!.value);
    instant +=
      wall -
      Date.UTC(
        n("year"),
        n("month") - 1,
        n("day"),
        n("hour"),
        n("minute"),
        n("second"),
      );
  }
  return new Date(instant);
}

export async function getDashboardMetrics(studioId: string, now = new Date()) {
  const db = studioDb(studioId);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    Number(date.find((p) => p.type === type)!.value);
  const [y, m, d] = [part("year"), part("month"), part("day")];
  const dayStart = warsawDate(y!, m!, d!);
  const dayEnd = warsawDate(y!, m!, d! + 1);
  const workStart = warsawDate(y!, m!, d!, 8).getTime();
  const workEnd = warsawDate(y!, m!, d!, 16).getTime();
  const monthStart = warsawDate(y!, m!, 1);
  const monthEnd = warsawDate(y!, m! + 1, 1);
  const [
    revenue,
    statuses,
    bays,
    orders,
    clients,
    regular,
    reminders,
    rejected,
  ] = await Promise.all([
    db.workOrder.aggregate({
      where: {
        status: "completed",
        completedAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { totalGross: true },
    }),
    db.workOrder.groupBy({
      by: ["status"],
      where: { status: { in: [...activeStatuses] } },
      _count: { _all: true },
    }),
    db.bay.findMany({
      orderBy: { sort: "asc" },
      select: { id: true, name: true },
    }),
    db.workOrder.findMany({
      where: {
        status: { in: [...activeStatuses] },
        scheduledFrom: { lt: dayEnd },
        scheduledTo: { gt: dayStart },
      },
      include: { vehicle: true, client: true, bay: true },
      orderBy: [{ scheduledFrom: "asc" }, { number: "asc" }],
    }),
    db.client.count(),
    db.client.count({ where: { isRegular: true } }),
    db.coatingReminder.findMany({
      where: { completedAt: null, dueAt: { lt: warsawDate(y!, m!, d! + 8) } },
      select: { vehicle: { select: { clientId: true } } },
    }),
    // The environment comes from this studio's setting, never a global TEST/PROD default.
    db.invoice.findMany({
      where: {
        status: "issued",
        ksefStatus: "rejected",
        OR: [
          { ksefEnv: "test", studio: { ksefEnv: "test" } },
          { ksefEnv: "production", studio: { ksefEnv: "production" } },
        ],
      },
      select: { id: true, number: true, ksefEnv: true },
      orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
    }),
  ]);
  const count = (status: string) =>
    statuses.find((s) => s.status === status)?._count._all ?? 0;
  let occupiedMs = 0;
  for (const bay of bays) {
    const intervals = orders
      .filter((o) => o.bayId === bay.id)
      .map(
        (o) =>
          [
            Math.max(workStart, o.scheduledFrom.getTime()),
            Math.min(workEnd, o.scheduledTo.getTime()),
          ] as const,
      )
      .filter(([start, end]) => end > start)
      .sort((a, b) => a[0] - b[0]);
    let until = workStart;
    for (const [start, end] of intervals) {
      occupiedMs += Math.max(0, end - Math.max(start, until));
      until = Math.max(until, end);
    }
  }
  const capacityHours = bays.length * 8;
  const featured = orders.find(
    (o) => o.status === "in_progress" && o.bayId !== null,
  );
  return {
    dateLabel: new Intl.DateTimeFormat("pl-PL", {
      timeZone: TIME_ZONE,
      dateStyle: "full",
    }).format(now),
    monthLabel: new Intl.DateTimeFormat("pl-PL", {
      timeZone: TIME_ZONE,
      month: "long",
    }).format(now),
    revenuePln: (revenue._sum.totalGross ?? new Prisma.Decimal(0)).toFixed(2),
    active: {
      total: statuses.reduce((sum, s) => sum + s._count._all, 0),
      inProgress: count("in_progress"),
      ready: count("ready_for_pickup"),
      accepted: count("accepted"),
    },
    occupancy: {
      percent: capacityHours
        ? Math.round((occupiedMs / HOUR / capacityHours) * 100)
        : 0,
      occupiedHours: occupiedMs / HOUR,
      capacityHours,
    },
    returning: {
      percent: clients ? Math.round((regular / clients) * 100) : 0,
      regular,
      total: clients,
    },
    todayOrders: orders.map((o) => ({
      number: o.number,
      vehicle: `${o.vehicle.make} ${o.vehicle.model}`,
      customer: o.client.name,
      plate: o.vehicle.plate,
      service: o.service,
      grossPln: o.totalGross.toFixed(2),
      bay: o.bay?.name ?? null,
      scheduledFrom: o.scheduledFrom.toISOString(),
      scheduledTo: o.scheduledTo.toISOString(),
      dueAt: o.dueAt?.toISOString() ?? null,
      status:
        o.status === "in_progress"
          ? ("in-progress" as const)
          : o.status === "ready_for_pickup"
            ? ("ready-for-pickup" as const)
            : ("scheduled" as const),
    })),
    plan: {
      bays,
      bookings: orders
        .filter((o) => o.bayId !== null)
        .map((o) => ({
          number: o.number,
          bayId: o.bayId!,
          vehicle: `${o.vehicle.make} ${o.vehicle.model}`,
          service: o.service,
          start: Math.max(0, (o.scheduledFrom.getTime() - workStart) / HOUR),
          end: Math.min(8, (o.scheduledTo.getTime() - workStart) / HOUR),
          active: o.status === "in_progress",
        })),
    },
    alerts: {
      coatingClients: new Set(reminders.map((r) => r.vehicle.clientId)).size,
      rejected,
    },
    featured: featured
      ? {
          id: featured.id,
          number: featured.number,
          vehicle: `${featured.vehicle.make} ${featured.vehicle.model}`,
          customer: featured.client.name,
          plate: featured.vehicle.plate,
          service: featured.service,
          bay: featured.bay!.name,
          stage: featured.stage,
          dueAt: featured.dueAt?.toISOString() ?? null,
          grossPln: featured.totalGross.toFixed(2),
          status: "in-progress" as const,
        }
      : null,
  };
}

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;
