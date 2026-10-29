import { z } from "zod";
import { studioDb } from "../../../lib/db/tenant";
import { AccessError } from "../access-error";

// Int in PostgreSQL; full pieces/ml only. No coercion, rounding or float arithmetic.
const amount = z.number().int().min(0).max(2_000_000_000);
export const chemicalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  unit: z.enum(["piece", "ml"]),
  quantity: amount,
  lowThreshold: amount,
  reason: z.string().trim().min(1).max(280),
}).strict();
export const correctionSchema = z.object({
  quantity: amount,
  lowThreshold: amount,
  version: z.number().int().min(0).max(2_000_000_000),
  reason: z.string().trim().min(1).max(280),
}).strict();

export type ChemicalRecord = {
  id: string; name: string; unit: "piece" | "ml"; quantity: number;
  lowThreshold: number; version: number; lastReason: string;
};
const select = { id: true, name: true, unit: true, quantity: true, lowThreshold: true, version: true, lastReason: true } as const;

export function listChemicals(studioId: string): Promise<ChemicalRecord[]> {
  return studioDb(studioId).chemical.findMany({ select, orderBy: [{ name: "asc" }, { id: "asc" }] });
}

export function lowStock(studioId: string) {
  const db = studioDb(studioId);
  return db.chemical.findMany({
    where: { quantity: { lte: db.chemical.fields.lowThreshold } },
    select, orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function createChemical(studioId: string, input: unknown) {
  const { reason, ...data } = chemicalSchema.parse(input);
  return studioDb(studioId).chemical.create({ data: { ...data, studioId, lastReason: reason }, select });
}

export async function correctChemical(studioId: string, id: string, input: unknown) {
  const { version, reason, ...data } = correctionSchema.parse(input);
  const db = studioDb(studioId);
  // A single conditional UPDATE takes a row lock. Only one correction with this
  // version can succeed, even across processes. RETURNING avoids a second read race.
  const [updated] = await db.chemical.updateManyAndReturn({
    where: { id, version }, data: { ...data, lastReason: reason, version: { increment: 1 } }, select,
  });
  if (updated) return updated;
  if (!await db.chemical.findFirst({ where: { id }, select: { id: true } })) {
    throw new AccessError(404, "Nie znaleziono pozycji magazynu.");
  }
  throw new AccessError(409, "Stan zmienił się w międzyczasie. Odśwież listę i ponów korektę.");
}
