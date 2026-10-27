import Decimal from "decimal.js";
import type { Plan, StudioStatus } from "@/lib/db/generated/client";
import { calculateMrr } from "../billing/mrr";

export const TIME_ZONE = "Europe/Warsaw";
const WEEK = 7 * 86_400_000;
const ACTIVATION_ORDERS = 3;

export type StudioSnapshot = {
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
    [...studios].filter((studio) => wasPayingAt(studio, at)).map((studio) => ({ status: "active" as const, plan: studio.plan })),
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

export function formatRate(rate: number | null) {
  if (rate === null) return "—";
  const pct = new Decimal(rate).times(100);
  const text = pct.equals(pct.toDecimalPlaces(0)) ? pct.toFixed(0) : pct.toDecimalPlaces(1).toFixed(1).replace(".", ",");
  return `${text}%`;
}

export { WEEK };
