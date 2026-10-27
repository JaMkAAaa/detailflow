"use server";
import { requireStudio } from "@/src/server/studio/context";
import { updateService } from "@/src/server/wyceny/catalog";

async function result<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, value: await operation() }; }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." }; }
}
export async function updateServiceAction(studioId: string, id: string, input: unknown) {
  const context = await requireStudio("quotes:write");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  return result(() => updateService(studioId, id, input));
}
