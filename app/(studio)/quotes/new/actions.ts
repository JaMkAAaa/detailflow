"use server";
import { requireStudio } from "@/src/server/studio/context";
import { saveQuote, sendQuote } from "@/src/server/wyceny/send";
import { updateService } from "@/src/server/wyceny/catalog";
import { env } from "@/lib/env";

async function result<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, value: await operation() }; }
  catch (error) { return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." }; }
}
export async function saveQuoteAction(studioId: string, input: unknown) {
  const context = await requireStudio("quotes:manage");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  return result(() => saveQuote(studioId, context.user.id, input));
}
export async function sendQuoteAction(studioId: string, id: string) {
  const context = await requireStudio("quotes:manage");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  return result(() => sendQuote(studioId, id, env.APP_URL));
}
export async function updateServiceAction(studioId: string, id: string, input: unknown) {
  const context = await requireStudio("quotes:manage");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  return result(() => updateService(studioId, id, input));
}
