import Decimal from "decimal.js";
import { platformDb } from "@/lib/db/client";
import { BILLING_PLANS } from "../billing/plans";
import { periodNet } from "@/lib/billing/catalog";
import { COST_CATEGORIES } from "./costs";
import {
  arrears,
  churnStats,
  formatRate,
  mrrByPlan,
  operatingMargin,
  startOfWarsawMonth,
  warsawParts,
  warsawPeriodLabel,
  TIME_ZONE,
} from "./metrics";

export async function getPlatformSubscriptions(now = new Date()) {
  const start = startOfWarsawMonth(now);
  const { year, month } = warsawParts(now);
  const [studios, collected, costRows] = await Promise.all([
    platformDb.studio.findMany({
      select: {
        id: true, name: true, publicCode: true, status: true, plan: true, billingInterval: true, subscriptionNet: true,
        createdAt: true, updatedAt: true, activatedAt: true, trialEndsAt: true,
      },
      orderBy: { name: "asc" },
    }),
    platformDb.subscriptionPayment.aggregate({
      where: { paidAt: { gte: start, lte: now } },
      _sum: { amountNet: true },
    }),
    platformDb.platformCost.findMany({ where: { year, month } }),
  ]);

  const composition = mrrByPlan(studios);
  const due = arrears(studios);
  const costs = COST_CATEGORIES.map((category) => {
    const row = costRows.find((item) => item.category === category);
    return { category, amount: row ? row.amountNet.toFixed(2) : "0.00" };
  });
  const costTotal = costs.reduce((sum, row) => sum.plus(row.amount), new Decimal(0));
  const margin = operatingMargin(composition.total, costTotal);
  const collectedNet = collected._sum.amountNet ? new Decimal(collected._sum.amountNet.toString()) : new Decimal(0);

  return {
    periodLabel: warsawPeriodLabel(now),
    monthLabel: new Intl.DateTimeFormat("pl-PL", { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(now),
    mrr: composition.total.toFixed(2),
    composition: composition.rows.map((row) => ({
      plan: row.plan,
      label: BILLING_PLANS[row.plan].name,
      count: row.count,
      unit: row.count ? row.amount.div(row.count).toFixed(2) : "0.00",
      amount: row.amount.toFixed(2),
      share: composition.total.isZero() ? 0 : row.amount.div(composition.total).times(100).toNumber(),
    })),
    collected: collectedNet.toFixed(2),
    arrears: { count: due.count, amount: due.total.toFixed(2) },
    arrearsRows: studios.filter((studio) => studio.status === "past_due").map((studio) => ({
      id: studio.id,
      name: studio.name,
      publicCode: studio.publicCode,
      plan: BILLING_PLANS[studio.plan].name,
      amount: periodNet(studio).toFixed(2),
      interval: studio.billingInterval,
    })),
    churn: churnStats(studios, now),
    costs,
    costTotal: costTotal.toFixed(2),
    costsEntered: costRows.length > 0,
    marginLabel: formatRate(margin),
    marginWidth: margin === null ? 0 : Math.max(0, Math.min(100, margin.times(100).toNumber())),
  };
}

export type PlatformSubscriptions = Awaited<ReturnType<typeof getPlatformSubscriptions>>;
