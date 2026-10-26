import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireSession } from "../../../lib/auth/session";
import { platformDb } from "../../../lib/db/client";
import { authorizeStudio, AccessError, type Permission } from "../acl";

export const STUDIO_COOKIE = "df.active_studio";

// Odkrywanie membershipów to operacja auth/platformy. Dane studia czytamy
// dopiero po sprawdzeniu membershipu, przez studioDb.
export async function studioChoices(userId: string) {
  return platformDb.user.findUniqueOrThrow({
    where: { id: userId },
    select: { memberships: { orderBy: { createdAt: "asc" }, select: {
      studioId: true, role: true, studio: { select: { name: true, city: true, district: true } },
    } } },
  }).then((user) => user.memberships);
}

export async function requireStudio(permission: Permission = "studio:read") {
  const session = await requireSession();
  const choices = await studioChoices(session.user.id);
  const selected = (await cookies()).get(STUDIO_COOKIE)?.value;
  const studioId = choices.find((m) => m.studioId === selected)?.studioId ?? choices[0]?.studioId;
  if (!studioId) notFound();
  try {
    return { ...await authorizeStudio(session.user.id, studioId, permission), studioId, choices, user: session.user };
  } catch (error) {
    if (error instanceof AccessError) notFound();
    throw error;
  }
}
