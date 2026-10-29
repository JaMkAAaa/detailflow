import type { Plan, StudioStatus } from "@/lib/db/generated/client";
import { plans } from "@/lib/landing/plans";
import { BILLING_PLANS } from "@/src/server/billing/plans";

/** Cztery rozłączne grupy z A-02. `canceled` wchodzi w Wstrzymane, więc suma filtrów = wszystkie konta. */
export const STUDIO_ACCOUNT_FILTERS = ["all", "active", "trial", "past_due", "suspended"] as const;
export type StudioAccountFilter = (typeof STUDIO_ACCOUNT_FILTERS)[number];
export type StudioAccountBucket = Exclude<StudioAccountFilter, "all">;

export type StudioAccountCounts = Record<StudioAccountFilter, number>;

export const STUDIOS_PER_PAGE = 20;

export type StudiosQuery = {
  q: string;
  filter: StudioAccountFilter;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const STATUS_LABEL: Record<StudioStatus, string> = {
  active: "Aktywne",
  trial: "Trial",
  past_due: "Zaległe",
  suspended: "Wstrzymane",
  canceled: "Anulowane",
};

export const FILTER_LABEL: Record<StudioAccountFilter, string> = {
  all: "Wszystkie",
  active: "Aktywne",
  trial: "Trial",
  past_due: "Zaległe",
  suspended: "Wstrzymane",
};

/** Limity z cennika L-01 (Solo 1/1, Studio 5/4, Pro bez limitu). `null` = bez limitu. */
export const PLAN_LIMITS: Record<Plan, { users: number | null; bays: number | null }> = {
  solo: { users: 1, bays: plans.find(plan => plan.id === "solo")!.maxBays },
  studio: { users: 5, bays: plans.find(plan => plan.id === "studio")!.maxBays },
  pro: { users: null, bays: plans.find(plan => plan.id === "pro")!.maxBays },
};

export function accountFilterForStatus(status: StudioStatus): StudioAccountBucket {
  if (status === "canceled") return "suspended";
  return status;
}

export function statusesForFilter(filter: StudioAccountFilter): StudioStatus[] {
  if (filter === "all") return ["trial", "active", "past_due", "suspended", "canceled"];
  if (filter === "suspended") return ["suspended", "canceled"];
  return [filter];
}

export function partitionByStatus(rows: { status: StudioStatus }[]): StudioAccountCounts {
  const counts: StudioAccountCounts = { all: 0, active: 0, trial: 0, past_due: 0, suspended: 0 };
  for (const row of rows) {
    counts[accountFilterForStatus(row.status)] += 1;
    counts.all += 1;
  }
  return counts;
}

/** Netto PLN z groszy cennika, bez float. Trial nie ma abonamentu. */
export function planNet(plan: Plan): string {
  const grosze = BILLING_PLANS[plan].unitAmount;
  return `${Math.floor(grosze / 100)}.${String(grosze % 100).padStart(2, "0")}`;
}

export function subscriptionNet(status: StudioStatus, plan: Plan): string | null {
  return status === "trial" ? null : planNet(plan);
}

export function parseStudiosQuery(params: Params): StudiosQuery {
  const filter = first(params.filter);
  const page = Number(first(params.page));
  return {
    q: (first(params.q) ?? "").trim().slice(0, 80),
    filter: STUDIO_ACCOUNT_FILTERS.find((item) => item === filter) ?? "all",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function studiosHref(query: Partial<StudiosQuery>) {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.filter && query.filter !== "all") search.set("filter", query.filter);
  if (query.page && query.page > 1) search.set("page", String(query.page));
  const qs = search.toString();
  return qs ? `/admin/studios?${qs}` : "/admin/studios";
}

export function studiosExportHref(query: Pick<StudiosQuery, "q" | "filter">) {
  const search = new URLSearchParams();
  if (query.q) search.set("q", query.q);
  if (query.filter !== "all") search.set("filter", query.filter);
  const qs = search.toString();
  return qs ? `/admin/studios/export?${qs}` : "/admin/studios/export";
}

export function auditEventLabel(action: string) {
  if (action === "studio.created") return "Konto utworzone";
  if (action === "billing.subscription_active") return "Abonament aktywny";
  if (action === "studio.suspended") return "Konto wstrzymane";
  if (action === "support.session.started") return "Sesja wsparcia";
  if (action === "support.ticket.opened") return "Zgłoszenie otwarte";
  if (action === "support.ticket.replied") return "Odpowiedź wsparcia";
  if (action === "support.ticket.resolved") return "Zgłoszenie zamknięte";
  if (action === "platform.operator.role") return "Zmiana roli operatora";
  if (action === "platform.flag.set") return "Zmiana flagi";
  if (action === "platform.mfa.enabled") return "Włączono MFA";
  return action;
}

export type StudioCsvRow = {
  publicCode: string;
  name: string;
  status: StudioStatus;
  plan: Plan;
  city: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  phone: string | null;
  lastActivityAt: Date;
  subscriptionNet: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

function csvCell(value: string) {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
}

/** CSV z separatorem `;` i BOM, żeby Excel PL otworzył polskie znaki. */
export function studiosToCsv(rows: StudioCsvRow[]): string {
  const header = [
    "kod",
    "nazwa",
    "status",
    "plan",
    "miasto",
    "wlasciciel",
    "email",
    "telefon",
    "ostatnia_aktywnosc",
    "abonament_netto_pln",
    "stripe_customer",
    "stripe_subscription",
  ];
  const lines = rows.map((row) =>
    [
      row.publicCode,
      row.name,
      STATUS_LABEL[row.status],
      BILLING_PLANS[row.plan].name,
      row.city ?? "",
      row.ownerName ?? "",
      row.ownerEmail ?? "",
      row.phone ?? "",
      row.lastActivityAt.toISOString(),
      row.subscriptionNet ?? "",
      row.stripeCustomerId ?? "",
      row.stripeSubscriptionId ?? "",
    ]
      .map(csvCell)
      .join(";"),
  );
  return `\uFEFF${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}
