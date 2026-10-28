"use server";

import { revalidatePath } from "next/cache";
import { AccessError, authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { setStudioKsefEnv } from "@/src/ksef/submissions";
import { requireStudio } from "@/src/server/studio/context";

export async function setKsefEnvAction(_prev: { error: string }, form: FormData): Promise<{ error: string }> {
  await assertActionOrigin();
  const context = await requireStudio("invoices:manage");
  if (context.member.role !== "owner") return { error: "Tylko właściciel studia zmienia środowisko KSeF." };
  const env = form.get("env");
  if (env !== "test" && env !== "production") return { error: "Nieprawidłowe środowisko KSeF." };
  try {
    await authorizeStudio(context.user.id, context.studioId, "invoices:manage", true);
    await setStudioKsefEnv(context.studioId, env, context.user.id);
  } catch (error) {
    return { error: error instanceof AccessError ? error.message : "Nie udało się zmienić środowiska KSeF." };
  }
  revalidatePath("/", "layout");
  revalidatePath("/invoices");
  return { error: "" };
}
