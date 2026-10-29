import Decimal from "decimal.js";
import type { Plan, StudioStatus } from "@/lib/db/generated/client";
import { monthlyNet, periodNet, type BillingSnapshot } from "@/lib/billing/catalog";
import { calculateMrr } from "../billing/mrr";

export const TIME_ZONE = "Europe/Warsaw";
const WEEK = 7 * 86_400_000;
const ACTIVATION_ORDERS = 3;

export type StudioSnapshot = BillingSnapshot & {
  id: string;
  name: string;
  publicCode: string;
  status: StudioStatus;
  plan: Plan;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  trialEndsAt: Date | null;
};

export type PlatformOverview = {
  dateLabel: string;
  studioTotal: number;
  mrr: string;
  mrrDelta: string;
  growth: number | null;
  paying: number;
  trials: number;
  activity: { active: number; paying: number; rate: number | null };
  series: { label: string; mrr: string }[];
  activation: { activated: number; eligible: number; rate: number | null };
  conversion: { paid: number; completed: number; rate: number | null };
  inbox: { id: string; href: string; title: string; detail: string; tone: "error" | "warn" }[];
};

export function trialCount(studios: Iterable<{ status: StudioStatus; trialEndsAt: Date | null }>, now: Date) {
  let n = 0;
  for (const studio of studios) {
    if (studio.status === "trial" && studio.trialEndsAt && studio.trialEndsAt > now) n += 1;
  }
  return n;
}

/** Płatne / zakończone triale. Bieżące triale nie wchodzą do mianownika. */
export function trialConversion(
  studios: Iterable<{ status: StudioStatus; trialEndsAt: Date | null }>,
  now: Date,
) {
  let completed = 0;
  let paid = 0;
  for (const studio of studios) {
    if (!studio.trialEndsAt || studio.trialEndsAt > now) continue;
    completed += 1;
    if (studio.status === "active") paid += 1;
  }
  return { paid, completed, rate: completed === 0 ? null : paid / completed };
}

export function wasPayingAt(studio: StudioSnapshot, at: Date) {
  const start = studio.activatedAt ?? (studio.status === "active" ? studio.createdAt : null);
  if (!start || start > at) return false;
  if (studio.status === "active") return true;
  return studio.updatedAt > at;
}

export function mrrAt(studios: Iterable<StudioSnapshot>, at: Date) {
  return calculateMrr(
    [...studios].filter((studio) => wasPayingAt(studio, at)).map((studio) => ({ ...studio, status: "active" as const })),
  );
}

export function mrrSeries(studios: Iterable<StudioSnapshot>, now: Date, months = 6) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(now);
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const y = n("year");
  const m = n("month");
  return Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const monthIndex = m - offset;
    const at = offset === 0 ? now : new Date(Date.UTC(y, monthIndex, 1));
    const label = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, month: "short" }).format(at);
    return { label, at, mrr: mrrAt(studios, at) };
  });
}

export function activationRate(
  studios: Iterable<{ id: string; createdAt: Date }>,
  firstWeekOrders: Map<string, number>,
  now: Date,
) {
  let eligible = 0;
  let activated = 0;
  for (const studio of studios) {
    if (studio.createdAt.getTime() + WEEK > now.getTime()) continue;
    eligible += 1;
    if ((firstWeekOrders.get(studio.id) ?? 0) >= ACTIVATION_ORDERS) activated += 1;
  }
  return { activated, eligible, rate: eligible === 0 ? null : activated / eligible };
}

export function formatRate(rate: number | Decimal | null) {
  if (rate === null) return "—";
  const pct = new Decimal(rate).times(100);
  const rounded = pct.equals(pct.toDecimalPlaces(0)) ? pct.toFixed(0) : pct.toDecimalPlaces(1).toFixed(1);
  return `${rounded.replace(".", ",").replace("-", "−")}%`;
}

type WarsawParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function warsawParts(at: Date): WarsawParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((part) => part.type === type)!.value);
  return { year: n("year"), month: n("month"), day: n("day"), hour: n("hour"), minute: n("minute"), second: n("second") };
}

function zonedMidnight(year: number, month: number, day: number) {
  for (const hours of [1, 2]) {
    const instant = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - hours * 3_600_000);
    const parts = warsawParts(instant);
    if (parts.year === year && parts.month === month && parts.day === day && parts.hour === 0 && parts.minute === 0) return instant;
  }
  throw new Error("Nie udało się ustalić północy w Europe/Warsaw.");
}

export function startOfWarsawDay(at: Date) {
  const parts = warsawParts(at);
  return zonedMidnight(parts.year, parts.month, parts.day);
}

export function startOfWarsawMonth(at: Date) {
  const parts = warsawParts(at);
  return zonedMidnight(parts.year, parts.month, 1);
}

export function addWarsawDays(at: Date, days: number) {
  const parts = warsawParts(at);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedMidnight(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

function warsawWeekday(at: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(at);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(name);
  if (index < 0) throw new Error("Nieznany dzień tygodnia.");
  return index;
}

export function startOfWarsawWeek(at: Date) {
  const day = startOfWarsawDay(at);
  return addWarsawDays(day, -warsawWeekday(day));
}

export function warsawPeriodLabel(now: Date) {
  const start = startOfWarsawMonth(now);
  const day = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, day: "numeric" });
  const month = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, month: "long", year: "numeric" });
  return `${day.format(start)}–${day.format(now)} ${month.format(now)}`;
}

const PLAN_ORDER = ["solo", "studio", "pro"] as const;

export function mrrByPlan(studios: Iterable<BillingSnapshot & { status: StudioStatus }>) {
  const buckets = {
    solo: { count: 0, amount: new Decimal(0) },
    studio: { count: 0, amount: new Decimal(0) },
    pro: { count: 0, amount: new Decimal(0) },
  };
  for (const studio of studios) {
    if (studio.status !== "active") continue;
    const bucket = buckets[studio.plan];
    bucket.count += 1;
    bucket.amount = bucket.amount.plus(monthlyNet(studio));
  }
  const total = PLAN_ORDER.reduce((sum, plan) => sum.plus(buckets[plan].amount), new Decimal(0));
  return { total, rows: PLAN_ORDER.map((plan) => ({ plan, ...buckets[plan] })) };
}

/** Cena pełnego okresu kont past_due; nie saldo Stripe po proration/kredytach. Poza MRR. */
export function arrears(studios: Iterable<BillingSnapshot & { status: StudioStatus }>) {
  let count = 0;
  let total = new Decimal(0);
  for (const studio of studios) {
    if (studio.status !== "past_due") continue;
    count += 1;
    total = total.plus(periodNet(studio));
  }
  return { count, total };
}

/** Churn = anulowane w miesiącu / płacące na początku miesiąca. Nieudane triale nie wchodzą. */
export function churnStats(studios: Iterable<StudioSnapshot>, now: Date) {
  const start = startOfWarsawMonth(now);
  let base = 0;
  let left = 0;
  let joined = 0;
  let paying = 0;
  for (const studio of studios) {
    if (studio.status === "active") paying += 1;
    const inBase = wasPayingAt(studio, start);
    if (inBase) base += 1;
    const leftThisMonth = studio.status === "canceled" && studio.activatedAt !== null
      && studio.updatedAt >= start && studio.updatedAt <= now && inBase;
    if (leftThisMonth) left += 1;
    const joinedThisMonth = studio.status === "active" && studio.activatedAt !== null
      && studio.activatedAt >= start && studio.activatedAt <= now && !inBase;
    if (joinedThisMonth) joined += 1;
  }
  return { base, left, joined, paying, rate: base === 0 ? null : left / base };
}

export function operatingMargin(mrr: Decimal, costs: Decimal) {
  if (mrr.lte(0)) return null;
  return mrr.minus(costs).div(mrr);
}

export type CohortCell = { rate: number | null; active: number; observed: number };

function weekRangeLabel(start: Date) {
  const end = addWarsawDays(start, 6);
  const fmt = new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/**
 * Retencja: udział kont z utworzonym lub zaktualizowanym zleceniem w tygodniu k
 * liczonym od rejestracji. Brak pełnych 7 dni obserwacji → rate null („—”, nie 0%).
 */
export function cohortRetention(
  studios: Iterable<{ id: string; createdAt: Date }>,
  orders: Iterable<{ studioId: string; createdAt: Date; updatedAt: Date }>,
  now: Date,
  options?: { rows?: number; weeks?: number },
) {
  const rows = options?.rows ?? 8;
  const weeks = options?.weeks ?? 5;
  const byStudio = new Map<string, { createdAt: number; updatedAt: number }[]>();
  for (const order of orders) {
    const list = byStudio.get(order.studioId);
    const point = { createdAt: order.createdAt.getTime(), updatedAt: order.updatedAt.getTime() };
    if (list) list.push(point);
    else byStudio.set(order.studioId, [point]);
  }
  const current = startOfWarsawWeek(now);
  const nowMs = now.getTime();
  return Array.from({ length: rows }, (_, index) => {
    const weekStart = addWarsawDays(current, -7 * (rows - 1 - index));
    const weekEnd = addWarsawDays(weekStart, 7);
    const members = [...studios].filter((studio) => studio.createdAt >= weekStart && studio.createdAt < weekEnd && studio.createdAt <= now);
    const cells: CohortCell[] = Array.from({ length: weeks }, (_, week) => {
      let observed = 0;
      let active = 0;
      for (const studio of members) {
        const start = studio.createdAt.getTime() + week * WEEK;
        const end = start + WEEK;
        if (nowMs < end) continue;
        observed += 1;
        const hit = (byStudio.get(studio.id) ?? []).some((order) =>
          (order.createdAt >= start && order.createdAt < end) || (order.updatedAt >= start && order.updatedAt < end));
        if (hit) active += 1;
      }
      return { rate: observed === 0 ? null : active / observed, active, observed };
    });
    return { label: weekRangeLabel(weekStart), cells };
  });
}

export { WEEK };
