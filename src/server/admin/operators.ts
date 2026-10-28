import type { PlatformRole } from "@/lib/db/generated/client";
import { platformDb } from "@/lib/db/client";
import { auditEventLabel } from "./accounts";
import { PlatformError } from "./errors";
import { assertMfaReady } from "./mfa";
import { PLATFORM_ROLES, canManageFlags, canManageRoles, demotionBlocked } from "./operator-policy";

export { PLATFORM_ROLES, ROLE_LABEL, canManageFlags, canManageRoles } from "./operator-policy";

export const FLAG_DEFAULTS = [
  {
    key: "ksef_prod",
    label: "KSeF PROD",
    description: "Wysyłka na produkcyjne API KSeF. Domyślnie wyłączona. Worker v1 obsługuje tylko TEST.",
    enabled: false,
  },
  {
    key: "annual_billing",
    label: "Abonament roczny",
    description: "Poza v1. Nie tworzy ceny rocznej w Stripe.",
    enabled: false,
  },
  {
    key: "client_online_pay",
    label: "Płatność online klienta",
    description: "Poza v1. Nie przyjmuje płatności za detailing.",
    enabled: false,
  },
] as const;

export async function ensureFeatureFlags() {
  for (const flag of FLAG_DEFAULTS) {
    await platformDb.featureFlag.upsert({
      where: { key: flag.key },
      update: {},
      create: { key: flag.key, label: flag.label, description: flag.description, enabled: flag.enabled },
    });
  }
}

type Actor = { userId: string; role: PlatformRole; sessionId: string };

export async function changeOperatorRole(actor: Actor, targetUserId: string, nextRole: PlatformRole) {
  await assertMfaReady(actor.sessionId, actor.userId);
  if (!canManageRoles(actor.role)) throw new PlatformError("Tylko właściciel platformy zmienia role.");
  if (!PLATFORM_ROLES.includes(nextRole)) throw new PlatformError("Nieznana rola.");
  const target = await platformDb.platformOperator.findUnique({
    where: { userId: targetUserId },
    select: { id: true, role: true, user: { select: { email: true } } },
  });
  if (!target) throw new PlatformError("Nie ma takiego operatora.");
  if (target.role === nextRole) return;
  await platformDb.$transaction(async (tx) => {
    if (demotionBlocked(target.role, nextRole, await tx.platformOperator.count({ where: { role: "owner" } }))) {
      throw new PlatformError("Musi zostać co najmniej jeden właściciel platformy.");
    }
    await tx.platformOperator.update({ where: { id: target.id }, data: { role: nextRole } });
    await tx.auditLog.create({
      data: { actorId: actor.userId, action: "platform.operator.role", meta: { email: target.user.email, role: nextRole } },
    });
  });
}

export async function setFeatureFlag(actor: Actor, key: string, enabled: boolean) {
  await assertMfaReady(actor.sessionId, actor.userId);
  if (!canManageFlags(actor.role)) throw new PlatformError("Rola wsparcia nie zmienia flag.");
  const known = FLAG_DEFAULTS.find((flag) => flag.key === key);
  if (!known) throw new PlatformError("Nie ma takiej flagi.");
  await platformDb.$transaction(async (tx) => {
    await tx.featureFlag.upsert({
      where: { key },
      create: { key, label: known.label, description: known.description, enabled, updatedById: actor.userId },
      update: { enabled, updatedById: actor.userId },
    });
    await tx.auditLog.create({
      data: { actorId: actor.userId, action: "platform.flag.set", meta: { key, enabled } },
    });
  });
}

function detail(meta: unknown) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  if (typeof record.email === "string" && typeof record.role === "string") return `${record.email} → ${record.role}`;
  if (typeof record.key === "string") return `${record.key} → ${record.enabled ? "włączona" : "wyłączona"}`;
  if (typeof record.ticketCode === "string") return record.ticketCode;
  if (typeof record.reason === "string") return record.reason;
  return null;
}

export async function getAdministration() {
  await ensureFeatureFlags();
  const [operators, flags, logs] = await Promise.all([
    platformDb.platformOperator.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        user: { select: { id: true, name: true, email: true } },
        mfa: { select: { enabledAt: true } },
      },
    }),
    platformDb.featureFlag.findMany({ orderBy: { key: "asc" } }),
    platformDb.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
  ]);
  const actorIds = [...new Set(logs.map((row) => row.actorId).filter((id): id is string => !!id))];
  const studioIds = [...new Set(logs.map((row) => row.studioId).filter((id): id is string => !!id))];
  const [actors, studios] = await Promise.all([
    actorIds.length ? platformDb.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [],
    studioIds.length ? platformDb.studio.findMany({ where: { id: { in: studioIds } }, select: { id: true, name: true, publicCode: true } }) : [],
  ]);
  const actorName = new Map(actors.map((actor) => [actor.id, actor.name]));
  const studioName = new Map(studios.map((studio) => [studio.id, `${studio.name} · ${studio.publicCode}`]));
  return {
    operators: operators.map((operator) => ({
      userId: operator.user.id,
      name: operator.user.name,
      email: operator.user.email,
      role: operator.role,
      mfaEnabled: Boolean(operator.mfa?.enabledAt),
    })),
    flags: flags.map((flag) => ({
      key: flag.key,
      label: flag.label,
      description: flag.description,
      enabled: flag.enabled,
    })),
    audit: logs.map((row) => ({
      id: row.id,
      label: auditEventLabel(row.action),
      detail: detail(row.meta),
      actor: row.actorId ? actorName.get(row.actorId) ?? "—" : "—",
      studio: row.studioId ? studioName.get(row.studioId) ?? "—" : "—",
      at: row.createdAt.toISOString(),
    })),
  };
}

export type Administration = Awaited<ReturnType<typeof getAdministration>>;
