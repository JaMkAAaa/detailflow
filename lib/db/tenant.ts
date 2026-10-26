import { platformDb, type PlatformDb } from "./client";
import { Prisma } from "./generated/client";

// Modele z kolumną `studioId`. Każdy nowy model operacyjny dopisz tutaj,
// inaczej `studioDb` odrzuci zapytanie (bezpieczniej niż przepuścić bez filtra).
export const TENANT_MODELS = [
  "Membership",
  "Invitation",
  "Client",
  "Vehicle",
  "Bay",
  "WorkOrder",
  "WorkOrderEvent",
  "OrderCounter",
  "Quote",
  "QuoteItem",
  "Invoice",
  "InvoiceItem",
  "KsefEvent",
  "PortalLink",
  "CoatingReminder",
  "OrderPhoto",
  "IntakeProtocol",
  "IntakeDamage",
] as const satisfies readonly Prisma.ModelName[];

type TenantModel = (typeof TENANT_MODELS)[number];

// Delegaty modeli platformy są niedostępne z `studioDb` już na poziomie typów.
type PlatformDelegate = "studio" | "user" | "session" | "account" | "verification" | "stripeEvent" | "auditLog";

const tenantModels = new Set<string>(TENANT_MODELS);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);
const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

export class TenantScopeError extends Error {
  override name = "TenantScopeError";
}

type Args = Record<string, unknown>;

function scopeWhere(where: unknown, studioId: string, model: string): Args {
  const w = (where ?? {}) as Args;
  if (w.studioId !== undefined && w.studioId !== studioId) {
    throw new TenantScopeError(`${model}: where.studioId does not match the scoped studio`);
  }
  return { ...w, studioId };
}

function scopeData(data: unknown, studioId: string, model: string): Args {
  const d = (data ?? {}) as Args;
  if ("studio" in d) {
    throw new TenantScopeError(`${model}: set studioId through studioDb, not the studio relation`);
  }
  if (d.studioId !== undefined && d.studioId !== studioId) {
    throw new TenantScopeError(`${model}: data.studioId does not match the scoped studio`);
  }
  return { ...d, studioId };
}

function guardUpdate(data: unknown, studioId: string, model: string) {
  const d = (data ?? {}) as Args;
  if ("studio" in d || (d.studioId !== undefined && d.studioId !== studioId)) {
    throw new TenantScopeError(`${model}: a record cannot be moved to another studio`);
  }
}

/** Wymusza `studioId` w argumentach zapytania. Eksport dla testów. */
export function scopeArgs(model: string, operation: string, args: unknown, studioId: string): Args {
  if (!tenantModels.has(model)) {
    throw new TenantScopeError(`${model} is not tenant-scoped; use platformDb`);
  }
  const a = { ...((args ?? {}) as Args) };

  if (WHERE_OPS.has(operation)) {
    a.where = scopeWhere(a.where, studioId, model);
    if (operation.startsWith("update")) guardUpdate(a.data, studioId, model);
    return a;
  }
  if (CREATE_OPS.has(operation)) {
    a.data = Array.isArray(a.data)
      ? a.data.map((row) => scopeData(row, studioId, model))
      : scopeData(a.data, studioId, model);
    return a;
  }
  if (operation === "upsert") {
    a.where = scopeWhere(a.where, studioId, model);
    a.create = scopeData(a.create, studioId, model);
    guardUpdate(a.update, studioId, model);
    return a;
  }
  // Nieznana operacja (np. nowa w kolejnej wersji Prisma) = brak gwarancji filtra.
  throw new TenantScopeError(`${model}.${operation} is not supported by studioDb`);
}

function assertStudioId(studioId: unknown): asserts studioId is string {
  if (typeof studioId !== "string" || studioId.trim() === "") {
    throw new TenantScopeError("studioDb requires a non-empty studioId");
  }
}

function extend(base: PlatformDb, studioId: string) {
  return base.$extends({
    name: `tenant:${studioId}`,
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, studioId) as typeof args);
        },
      },
    },
  });
}

export type StudioDb = Omit<ReturnType<typeof extend>, PlatformDelegate | "$queryRaw" | "$queryRawUnsafe" | "$executeRaw" | "$executeRawUnsafe">;

/**
 * Klient Prisma zawężony do jednego studia. Każde zapytanie do modelu
 * operacyjnego dostaje `studioId` w `where`/`data`; niezgodny `studioId`,
 * model platformy albo surowy SQL kończą się `TenantScopeError`.
 *
 * Zagnieżdżone zapisy (np. `items: { create: [...] }`) dziedziczą `studioId`
 * z rodzica przez złożone klucze obce `(id, studioId)`.
 */
export function studioDb(studioId: string, base: PlatformDb = platformDb): StudioDb {
  assertStudioId(studioId);
  const client = extend(base, studioId);
  const blocked = new Set<PropertyKey>(["studio", "user", "session", "account", "verification", "stripeEvent", "auditLog", "$queryRaw", "$queryRawUnsafe", "$executeRaw", "$executeRawUnsafe"]);
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (blocked.has(prop)) {
        throw new TenantScopeError(`${String(prop)} is not available on studioDb; use platformDb`);
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as StudioDb;
}

export type { TenantModel };
