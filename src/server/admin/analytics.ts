import { platformDb } from "@/lib/db/client";
import {
  WEEK,
  activationRate,
  cohortRetention,
  startOfWarsawMonth,
  trialConversion,
  warsawPeriodLabel,
} from "./metrics";

const FEATURES = [
  { key: "orders", label: "Zlecenia" },
  { key: "quotes", label: "Wyceny" },
  { key: "portal", label: "Portal klienta" },
  { key: "photos", label: "Zdjęcia" },
  { key: "invoices", label: "Faktury PROD" },
] as const;

/** Udział płacących studiów. Faktury liczą tylko KSeF PROD — TEST nie wchodzi. */
export async function featureUsage(studioIds: string[], since: Date, now: Date) {
  const eligible = studioIds.length;
  if (eligible === 0) {
    return FEATURES.map((feature) => ({ ...feature, used: 0, eligible, rate: null as number | null }));
  }
  const window = { gte: since, lte: now };
  const scoped = { studioId: { in: studioIds } };
  const [orders, quotes, portal, photos, invoices] = await Promise.all([
    platformDb.workOrder.groupBy({
      by: ["studioId"],
      where: { ...scoped, OR: [{ createdAt: window }, { updatedAt: window }] },
    }),
    platformDb.quote.groupBy({ by: ["studioId"], where: { ...scoped, createdAt: window } }),
    platformDb.portalLink.groupBy({ by: ["studioId"], where: { ...scoped, createdAt: window } }),
    platformDb.orderPhoto.groupBy({
      by: ["studioId"],
      where: { ...scoped, createdAt: window, uploadedAt: { not: null } },
    }),
    platformDb.invoice.groupBy({
      by: ["studioId"],
      where: { ...scoped, ksefEnv: "production", status: "issued", issuedAt: window },
    }),
  ]);
  return FEATURES.map((feature, index) => {
    const used = [orders, quotes, portal, photos, invoices][index]!.length;
    return { ...feature, used, eligible, rate: used / eligible };
  });
}

export async function getPlatformAnalytics(now = new Date()) {
  const since = startOfWarsawMonth(now);
  const studios = await platformDb.studio.findMany({
    select: { id: true, status: true, plan: true, createdAt: true, trialEndsAt: true },
  });
  const payingIds = studios.filter((studio) => studio.status === "active").map((studio) => studio.id);
  const [orders, features] = await Promise.all([
    platformDb.workOrder.findMany({
      where: { createdAt: { lte: now } },
      select: { studioId: true, createdAt: true, updatedAt: true },
    }),
    featureUsage(payingIds, since, now),
  ]);
  const created = new Map(studios.map((studio) => [studio.id, studio.createdAt]));
  const firstWeek = new Map<string, number>();
  for (const order of orders) {
    const start = created.get(order.studioId);
    if (!start || order.createdAt < start || order.createdAt.getTime() > start.getTime() + WEEK) continue;
    firstWeek.set(order.studioId, (firstWeek.get(order.studioId) ?? 0) + 1);
  }
  return {
    periodLabel: warsawPeriodLabel(now),
    activation: activationRate(studios, firstWeek, now),
    conversion: trialConversion(studios, now),
    cohorts: cohortRetention(studios, orders, now),
    features,
  };
}

export type PlatformAnalytics = Awaited<ReturnType<typeof getPlatformAnalytics>>;
