"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { platformDb } from "@/lib/db/client";
import { authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { PortfolioError } from "@/src/server/portfolio/errors";
import { publishPhoto, unpublishPhoto } from "@/src/server/portfolio/publish";

async function run(studioId: string, write: boolean, operation: (actorId: string) => Promise<unknown>) {
  try {
    await assertActionOrigin();
    const context = await requireStudio();
    if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
    await authorizeStudio(context.user.id, studioId, "portfolio:manage", write);
    const value = await operation(context.user.id);
    const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { slug: true } });
    revalidatePath("/portfolio");
    if (studio) revalidatePath(`/realizacje/${studio.slug}`);
    return { ok: true as const, value };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false as const, error: error.issues[0]?.message ?? "Nieprawidłowe dane." };
    if (error instanceof PortfolioError) return { ok: false as const, error: error.message };
    return { ok: false as const, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." };
  }
}

export async function publishPortfolioPhoto(studioId: string, photoId: string, input: unknown) {
  return run(studioId, true, (actorId) => publishPhoto(studioId, photoId, actorId, input));
}

export async function unpublishPortfolioPhoto(studioId: string, photoId: string) {
  return run(studioId, false, (actorId) => unpublishPhoto(studioId, photoId, actorId));
}
