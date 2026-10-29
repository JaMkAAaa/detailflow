"use server";
import { revalidatePath } from "next/cache";
import { changeMember } from "@/src/server/studio/members";
import { assertActionOrigin } from "@/src/server/action-origin";
import { requireStudio } from "@/src/server/studio/context";
import { inviteMember } from "@/src/server/studio/invitations";

export async function sendInvite(_state: { message: string }, form: FormData) {
  await assertActionOrigin();
  const { user, studioId } = await requireStudio("members:invite");
  try {
    await inviteMember(user.id, studioId, { email: form.get("email"), role: form.get("role") });
    return { message: "Zaproszenie zostało wysłane." };
  } catch { return { message: "Nie udało się wysłać zaproszenia. Sprawdź adres i spróbuj ponownie." }; }
}

export async function updateMember(_state: { message: string }, form: FormData) {
  await assertActionOrigin();
  const { user, studioId } = await requireStudio("members:invite");
  try {
    const id = form.get("membershipId");
    if (typeof id !== "string" || !id) return { message: "Nieprawidłowy członek zespołu." };
    const operation = form.get("operation");
    if (operation !== "remove" && operation !== "role") return { message: "Nieprawidłowa operacja." };
    await changeMember(user.id, studioId, id, operation === "remove" ? undefined : form.get("role"));
    revalidatePath("/team");
    return { message: operation === "remove" ? "Dostęp został usunięty." : "Rola została zmieniona." };
  } catch { return { message: "Nie udało się zmienić dostępu. Odśwież listę i spróbuj ponownie." }; }
}
