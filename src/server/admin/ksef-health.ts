import type { KsefEnv, KsefStatus } from "@/lib/db/generated/client";

export const QUEUE_STUCK_MINUTES = 15;

export type KsefGroup = { env: KsefEnv; status: KsefStatus; count: number };

export type EnvAcceptance = {
  accepted: number;
  rejected: number;
  pending: number;
  total: number;
  rateLabel: string | null;
};

/** Jedno miejsce po przecinku, jak 828/842 → 98,3%. Pusty mianownik to brak udziału, nie 0%. */
export function acceptedPercent(accepted: number, total: number): string | null {
  if (total <= 0) return null;
  const tenths = Math.round((accepted * 1000) / total);
  return `${Math.floor(tenths / 10)},${tenths % 10}%`;
}

function emptyCounts() {
  return { accepted: 0, rejected: 0, pending: 0 };
}

function finish(counts: { accepted: number; rejected: number; pending: number }): EnvAcceptance {
  const total = counts.accepted + counts.rejected + counts.pending;
  return { ...counts, total, rateLabel: acceptedPercent(counts.accepted, total) };
}

/** `not_sent` nie wchodzi do mianownika. TEST i PROD nie sumują się nawzajem. */
export function splitKsefGroups(rows: KsefGroup[]) {
  const buckets = { test: emptyCounts(), production: emptyCounts() };
  for (const row of rows) {
    const bucket = buckets[row.env];
    if (row.status === "accepted") bucket.accepted += row.count;
    else if (row.status === "rejected") bucket.rejected += row.count;
    else if (row.status === "queued" || row.status === "processing" || row.status === "retrying") bucket.pending += row.count;
  }
  return { test: finish(buckets.test), production: finish(buckets.production) };
}

export function queueAgeMinutes(oldest: Date | null, now: Date): number | null {
  if (!oldest) return null;
  return Math.max(0, Math.floor((now.getTime() - oldest.getTime()) / 60_000));
}

export function queueIncidents(delays: { test: number | null; production: number | null }) {
  const incidents: { env: KsefEnv; title: string; detail: string }[] = [];
  for (const env of ["test", "production"] as const) {
    const age = delays[env];
    if (age !== null && age >= QUEUE_STUCK_MINUTES) {
      const label = env === "test" ? "TEST" : "PROD";
      incidents.push({
        env,
        title: `Kolejka KSeF ${label} stoi`,
        detail: `Najstarszy dokument czeka ${age} min. Licznik dotyczy tylko środowiska ${label}.`,
      });
    }
  }
  return incidents;
}

export function topErrorCategories(rows: { message: string; count: number }[]) {
  return rows
    .map((row) => ({ message: row.message.trim().slice(0, 80) || "bez opisu", count: row.count }))
    .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message, "pl"))
    .slice(0, 6);
}
