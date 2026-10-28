"use server";

import { revalidatePath } from "next/cache";
import { requirePlatform } from "@/src/server/admin/context";
import { formFailure, type FormState } from "@/src/server/admin/errors";
import { startSupportSession, suspendStudio } from "@/src/server/admin/studio-access";

export async function suspendStudioAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePlatform();
  const publicCode = String(form.get("publicCode") ?? "");
  try {
    await suspendStudio({
      actorId: user.id,
      publicCode,
      name: String(form.get("name") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
  } catch (error) {
    return formFailure(error);
  }
  revalidatePath(`/admin/studios/${publicCode}`);
  revalidatePath("/admin/studios");
  return { message: "Konto wstrzymane. Logowanie do tego studia jest odcięte.", tone: "ok" };
}

export async function startSupportSessionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePlatform();
  const publicCode = String(form.get("publicCode") ?? "");
  try {
    const session = await startSupportSession({
      actorId: user.id,
      publicCode,
      reason: String(form.get("reason") ?? ""),
      ticketCode: String(form.get("ticket") ?? ""),
    });
    revalidatePath(`/admin/studios/${publicCode}`);
    const until = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit" }).format(session.expiresAt);
    return { message: `Sesja tylko do odczytu do ${until}. Bez logowania jako studio.`, tone: "ok" };
  } catch (error) {
    return formFailure(error);
  }
}
