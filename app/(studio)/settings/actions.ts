"use server";

import { revalidatePath } from "next/cache";
import { AccessError, authorizeStudio } from "@/src/server/acl";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { updateStudioProfile } from "@/src/server/studio/profile";

export async function updateStudioProfileAction(
  _prev: { error: string; saved: boolean },
  form: FormData,
): Promise<{ error: string; saved: boolean }> {
  await assertActionOrigin();
  const context = await requireStudio("studio:settings");
  if (context.member.role !== "owner") return { error: "Tylko właściciel studia zmienia dane studia.", saved: false };
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  try {
    await authorizeStudio(context.user.id, context.studioId, "studio:settings", true);
    await updateStudioProfile(context.studioId, context.user.id, {
      name: field("name"),
      ownerLegalName: field("ownerLegalName"),
      nip: field("nip"),
      address: field("address"),
      postal: field("postal"),
      city: field("city"),
      phone: field("phone"),
    });
  } catch (error) {
    return { error: error instanceof AccessError ? error.message : "Nie udało się zapisać danych studia.", saved: false };
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { error: "", saved: true };
}
