"use server";
import { requireStudio } from "@/src/server/studio/context";
import { inviteMember } from "@/src/server/studio/invitations";

export async function sendInvite(_state: { message: string }, form: FormData) {
  const { user, studioId } = await requireStudio("members:invite");
  try {
    await inviteMember(user.id, studioId, { email: form.get("email"), role: form.get("role") });
    return { message: "Zaproszenie zostało wysłane." };
  } catch { return { message: "Nie udało się wysłać zaproszenia. Sprawdź adres i spróbuj ponownie." }; }
}
