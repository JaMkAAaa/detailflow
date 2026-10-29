"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { createChemical, correctChemical, type ChemicalRecord } from "@/src/server/magazyn/inventory";

async function run(studioId: string, operation: () => Promise<ChemicalRecord>) {
  try {
    await assertActionOrigin();
    const context = await requireStudio("inventory:manage");
    if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
    await authorizeStudio(context.user.id, studioId, "inventory:manage", true);
    const value = await operation();
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true as const, value };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false as const, error: "Nieprawidłowe dane. Podaj pełne sztuki lub ml i powód korekty." };
    return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." };
  }
}
export async function createChemicalAction(studioId: string, input: unknown) {
  return run(studioId, () => createChemical(studioId, input));
}
export async function correctChemicalAction(studioId: string, id: string, input: unknown) {
  return run(studioId, () => correctChemical(studioId, id, input));
}
