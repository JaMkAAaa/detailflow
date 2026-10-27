import { cache } from "react";
import { studioDb } from "@/lib/db/tenant";
import type { Environment } from "@/components/faktury/model";
import type { InvoiceRow } from "@/components/faktury/list-model";

const attentionWhere = { status: "issued" as const, ksefStatus: { in: ["rejected", "retrying"] as ("rejected" | "retrying")[] } };

export const invoiceAttentionCount = cache(async (studioId: string, env: Environment) =>
  studioDb(studioId).invoice.count({ where: { studioId, ksefEnv: env, ...attentionWhere } }),
);

export const invoiceList = cache(async (studioId: string, env: Environment): Promise<InvoiceRow[]> => {
  const rows = await studioDb(studioId).invoice.findMany({
    where: { studioId, ksefEnv: env },
    orderBy: [{ issuedAt: { sort: "desc", nulls: "last" } }, { number: "desc" }],
    select: {
      id: true, number: true, status: true, ksefEnv: true, ksefStatus: true,
      buyerName: true, buyerNip: true, issuedAt: true, dueAt: true, paidAt: true,
      totalGross: true, totalVat: true, ksefNumber: true,
      workOrder: { select: { number: true, client: { select: { phone: true } } } },
      events: { where: { studioId }, orderBy: { at: "desc" }, select: { kind: true, message: true, ref: true, attempt: true, at: true } },
    },
  });
  return rows.map(row => ({
    id: row.id, number: row.number, env: row.ksefEnv, status: row.status, ksefStatus: row.ksefStatus,
    buyerName: row.buyerName, buyerNip: row.buyerNip, orderNumber: row.workOrder.number, phone: row.workOrder.client.phone,
    issuedAt: row.issuedAt?.toISOString() ?? null, dueAt: row.dueAt?.toISOString() ?? null, paidAt: row.paidAt?.toISOString() ?? null,
    totalGross: row.totalGross.toString(), totalVat: row.totalVat.toString(), ksefNumber: row.ksefNumber,
    events: row.events.map(event => ({ ...event, at: event.at.toISOString() })),
  }));
});
