import type { Prisma } from "@/lib/db/generated/client";
import { platformDb } from "@/lib/db/client";
import { BILLING_PLANS } from "@/src/server/billing/plans";
import {
  PLAN_LIMITS,
  STUDIOS_PER_PAGE,
  auditEventLabel,
  partitionByStatus,
  statusesForFilter,
  studiosToCsv,
  subscriptionNet,
  type StudioAccountCounts,
  type StudioCsvRow,
  type StudiosQuery,
} from "./accounts";

const studioSelect = {
  id: true,
  publicCode: true,
  name: true,
  city: true,
  district: true,
  status: true,
  plan: true,
  phone: true,
  nip: true,
  address: true,
  postal: true,
  updatedAt: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  trialEndsAt: true,
  ksefEnv: true,
  members: {
    where: { role: "owner" as const },
    take: 1,
    orderBy: { createdAt: "asc" as const },
    select: { user: { select: { name: true, email: true } } },
  },
} satisfies Prisma.StudioSelect;

type StudioRow = Prisma.StudioGetPayload<{ select: typeof studioSelect }>;

function textWhere(q: string): Prisma.StudioWhereInput {
  if (!q) return {};
  const contains = { contains: q, mode: "insensitive" as const };
  return {
    OR: [
      { name: contains },
      { publicCode: contains },
      { city: contains },
      { nip: contains },
      { phone: contains },
      { members: { some: { role: "owner", user: { OR: [{ email: contains }, { name: contains }] } } } },
    ],
  };
}

function toCsvRow(studio: StudioRow, lastActivityAt: Date): StudioCsvRow {
  const owner = studio.members[0]?.user;
  return {
    publicCode: studio.publicCode,
    name: studio.name,
    status: studio.status,
    plan: studio.plan,
    city: studio.city,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    phone: studio.phone,
    lastActivityAt,
    subscriptionNet: subscriptionNet(studio.status, studio.plan),
    stripeCustomerId: studio.stripeCustomerId,
    stripeSubscriptionId: studio.stripeSubscriptionId,
  };
}

async function lastActivity(studios: StudioRow[]) {
  const activity = studios.length
    ? await platformDb.workOrder.groupBy({
        by: ["studioId"],
        where: { studioId: { in: studios.map((studio) => studio.id) } },
        _max: { updatedAt: true },
      })
    : [];
  const latest = new Map(activity.map((row) => [row.studioId, row._max.updatedAt]));
  return function at(studio: StudioRow) {
    const orderAt = latest.get(studio.id);
    return orderAt && orderAt > studio.updatedAt ? orderAt : studio.updatedAt;
  };
}

/** Wszystkie studia pasujące do szukania, posortowane po ostatniej aktywności. Liczebność tenantów, nie zleceń. */
export async function loadStudioRows(query: StudiosQuery) {
  const matched = await platformDb.studio.findMany({ where: textWhere(query.q), select: studioSelect });
  const counts = partitionByStatus(matched);
  const allowed = new Set(statusesForFilter(query.filter));
  const filtered = matched.filter((studio) => allowed.has(studio.status));
  const activityAt = await lastActivity(filtered);
  const rows = filtered
    .map((studio) => toCsvRow(studio, activityAt(studio)))
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || a.publicCode.localeCompare(b.publicCode));
  return { counts, rows };
}

export type StudioListItem = StudioCsvRow;

export type StudiosPage = {
  query: StudiosQuery;
  counts: StudioAccountCounts;
  rows: StudioListItem[];
  page: number;
  pages: number;
  total: number;
};

export async function listStudios(query: StudiosQuery): Promise<StudiosPage> {
  const { counts, rows } = await loadStudioRows(query);
  const pages = Math.max(1, Math.ceil(rows.length / STUDIOS_PER_PAGE));
  const page = Math.min(query.page, pages);
  return {
    query: { ...query, page },
    counts,
    rows: rows.slice((page - 1) * STUDIOS_PER_PAGE, page * STUDIOS_PER_PAGE),
    page,
    pages,
    total: rows.length,
  };
}

export async function studiosCsv(query: StudiosQuery) {
  const { rows } = await loadStudioRows(query);
  return studiosToCsv(rows);
}

export type StudioCard = {
  publicCode: string;
  name: string;
  status: StudioCsvRow["status"];
  plan: StudioCsvRow["plan"];
  planName: string;
  city: string | null;
  district: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  nip: string | null;
  addressLine: string | null;
  subscriptionNet: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  ksefEnv: "test" | "production";
  lastActivityAt: Date;
  limits: {
    users: { used: number; max: number | null };
    bays: { used: number; max: number | null };
  };
  events: { at: Date; label: string; detail: string | null }[];
};

function addressLine(studio: { address: string | null; postal: string | null; city: string | null; district: string | null }) {
  const place = [studio.postal, studio.city].filter(Boolean).join(" ");
  const line = [studio.address, [place, studio.district].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  return line || null;
}

function eventDetail(meta: Prisma.JsonValue) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  if (typeof meta.ticketCode === "string") return meta.ticketCode;
  if (typeof meta.reason === "string") return meta.reason;
  const plan = meta.plan;
  if (plan === "solo" || plan === "studio" || plan === "pro") return BILLING_PLANS[plan].name;
  return null;
}

/** Karta studia. Podgląd zostaje w AuditLog; te wpisy nie wracają na listę zdarzeń konta. */
export async function getStudioCard(publicCode: string, actorId: string): Promise<StudioCard | null> {
  const studio = await platformDb.studio.findUnique({
    where: { publicCode },
    select: {
      ...studioSelect,
      _count: { select: { members: true, bays: true } },
    },
  });
  if (!studio) return null;
  const [activityAt, events] = await Promise.all([
    lastActivity([studio]),
    platformDb.auditLog.findMany({
      where: { studioId: studio.id, NOT: { action: { startsWith: "platform.studio." } } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { action: true, meta: true, createdAt: true },
    }),
  ]);
  await platformDb.auditLog.create({
    data: { actorId, studioId: studio.id, action: "platform.studio.view", meta: { publicCode } },
  });
  const owner = studio.members[0]?.user;
  const limits = PLAN_LIMITS[studio.plan];
  return {
    publicCode: studio.publicCode,
    name: studio.name,
    status: studio.status,
    plan: studio.plan,
    planName: BILLING_PLANS[studio.plan].name,
    city: studio.city,
    district: studio.district,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    phone: studio.phone,
    nip: studio.nip,
    addressLine: addressLine(studio),
    subscriptionNet: subscriptionNet(studio.status, studio.plan),
    stripeCustomerId: studio.stripeCustomerId,
    stripeSubscriptionId: studio.stripeSubscriptionId,
    trialEndsAt: studio.trialEndsAt,
    ksefEnv: studio.ksefEnv,
    lastActivityAt: activityAt(studio),
    limits: {
      users: { used: studio._count.members, max: limits.users },
      bays: { used: studio._count.bays, max: limits.bays },
    },
    events: events.map((event) => ({ at: event.createdAt, label: auditEventLabel(event.action), detail: eventDetail(event.meta) })),
  };
}
