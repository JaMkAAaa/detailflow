"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { updateService } from "@/src/server/wyceny/catalog";

async function result<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, value: await operation() }; }
  catch (error) {
    if (error instanceof ZodError) return { ok: false as const, error: "Nieprawidłowe dane." };
    return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." };
  }
}
export async function updateServiceAction(studioId: string, id: string, input: unknown) {
  await assertActionOrigin();
  const context = await requireStudio("services:manage");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  try {
    await authorizeStudio(context.user.id, studioId, "services:manage", true);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." };
  }
  const saved = await result(() => updateService(studioId, id, input));
  if (saved.ok) {
    revalidatePath("/services");
    revalidatePath("/quotes/new");
  }
  return saved;
}
