import Decimal from "decimal.js";
import { platformDb } from "@/lib/db/client";
import { calculateMrr } from "../billing/mrr";
import {
  TIME_ZONE,
  WEEK,
  activationRate,
  mrrSeries,
  trialConversion,
  trialCount,
  type PlatformOverview,
} from "./metrics";

const DAY = 86_400_000;

export async function getPlatformOverview(now = new Date()): Promise<PlatformOverview> {
  const weekAgo = new Date(now.getTime() - WEEK);
  const trialHorizon = new Date(now.getTime() + 3 * DAY);
  const studios = await platformDb.studio.findMany({
    select: {
      id: true, name: true, publicCode: true, status: true, plan: true, billingInterval: true, subscriptionNet: true,
      createdAt: true, updatedAt: true, activatedAt: true, trialEndsAt: true,
    },
  });
  const paying = studios.filter((studio) => studio.status === "active");
  const payingIds = paying.map((studio) => studio.id);
  const [activeRows, firstWeekRows, pastDue, ksefRejected, endingTrials] = await Promise.all([
    payingIds.length === 0
      ? Promise.resolve([] as { studioId: string }[])
      : platformDb.workOrder.groupBy({
          by: ["studioId"],
          where: { studioId: { in: payingIds }, OR: [{ createdAt: { gte: weekAgo } }, { updatedAt: { gte: weekAgo } }] },
        }),
    platformDb.workOrder.findMany({
      where: { createdAt: { lte: now } },
      select: { studioId: true, createdAt: true },
    }),
    platformDb.studio.findMany({
      where: { status: "past_due" },
      select: { id: true, name: true, publicCode: true, plan: true },
      orderBy: { updatedAt: "desc" },
    }),
    platformDb.invoice.findMany({
      where: { status: "issued", ksefStatus: "rejected" },
      select: { id: true, number: true, ksefEnv: true, studioId: true, studio: { select: { name: true, publicCode: true } } },
      orderBy: { issuedAt: "desc" },
      take: 20,
    }),
    platformDb.studio.findMany({
      where: { status: "trial", trialEndsAt: { gt: now, lte: trialHorizon } },
      select: { id: true, name: true, publicCode: true, trialEndsAt: true },
      orderBy: { trialEndsAt: "asc" },
    }),
  ]);

  const created = new Map(studios.map((studio) => [studio.id, studio.createdAt]));
  const firstWeekOrders = new Map<string, number>();
  for (const row of firstWeekRows) {
    const start = created.get(row.studioId);
    if (!start) continue;
    if (row.createdAt < start || row.createdAt.getTime() > start.getTime() + WEEK) continue;
    firstWeekOrders.set(row.studioId, (firstWeekOrders.get(row.studioId) ?? 0) + 1);
  }

  const mrr = calculateMrr(studios);
  const series = mrrSeries(studios, now);
  const previous = series.length >= 2 ? series[series.length - 2]!.mrr : new Decimal(0);
  const delta = mrr.minus(previous);
  const growth = previous.isZero() ? null : delta.div(previous).toNumber();
  const conversion = trialConversion(studios, now);
  const activation = activationRate(studios, firstWeekOrders, now);
  const activePaying = activeRows.length;
  const activityRate = paying.length === 0 ? null : activePaying / paying.length;

  const inbox = [
    ...pastDue.map((studio) => ({
      id: `past-due:${studio.id}`,
      href: "/admin/studios",
      title: `${studio.name} · zaległość`,
      detail: `${studio.publicCode} · abonament po terminie`,
      tone: "error" as const,
    })),
    ...ksefRejected.map((invoice) => ({
      id: `ksef:${invoice.id}`,
      href: "/admin/system",
      title: `${invoice.number} · odrzucona (${invoice.ksefEnv === "test" ? "TEST" : "PROD"})`,
      detail: `${invoice.studio.name} · ${invoice.studio.publicCode}`,
      tone: "error" as const,
    })),
    ...endingTrials.map((studio) => ({
      id: `trial:${studio.id}`,
      href: "/admin/studios",
      title: `${studio.name} · trial kończy się`,
      detail: `${studio.publicCode} · ${studio.trialEndsAt!.toLocaleString("pl-PL", { timeZone: TIME_ZONE })}`,
      tone: "warn" as const,
    })),
  ];

  return {
    dateLabel: new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, dateStyle: "full" }).format(now),
    studioTotal: studios.length,
    mrr: mrr.toFixed(2),
    mrrDelta: delta.toFixed(2),
    growth,
    paying: paying.length,
    trials: trialCount(studios, now),
    activity: { active: activePaying, paying: paying.length, rate: activityRate },
    activation,
    conversion,
    series: series.map((point) => ({ label: point.label, mrr: point.mrr.toFixed(2) })),
    inbox,
  };
}

export type { PlatformOverview };
