"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { createService, deleteService, updateService, type ServiceRecord } from "@/src/server/wyceny/catalog";

export type ServiceActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

async function guard(studioId: string) {
  await assertActionOrigin();
  const context = await requireStudio("services:manage");
  if (context.studioId !== studioId) return { ok: false as const, error: "Aktywne studio uległo zmianie. Odśwież stronę." };
  await authorizeStudio(context.user.id, studioId, "services:manage", true);
  return { ok: true as const };
}

async function run<T>(studioId: string, operation: () => Promise<T>): Promise<ServiceActionResult<T>> {
  try {
    const access = await guard(studioId);
    if (!access.ok) return access;
    const value = await operation();
    revalidatePath("/services");
    revalidatePath("/quotes/new");
    revalidatePath("/orders");
    revalidatePath("/calendar");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: "Nieprawidłowe dane." };
    return { ok: false, error: error instanceof Error ? error.message : "Nie udało się zapisać zmian." };
  }
}

export async function createServiceAction(studioId: string, input: unknown) {
  return run(studioId, () => createService(studioId, input));
}

export async function updateServiceAction(studioId: string, id: string, input: unknown) {
  return run<ServiceRecord>(studioId, () => updateService(studioId, id, input));
}

export async function deleteServiceAction(studioId: string, id: string) {
  return run(studioId, () => deleteService(studioId, id));
}
