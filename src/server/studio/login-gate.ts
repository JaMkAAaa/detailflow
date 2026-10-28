import { platformDb } from "@/lib/db/client";

/** Nowe logowanie studia odpada, gdy każde membership jest wstrzymane. Brak studia nie blokuje. */
export async function studioLoginBlocked(userId: string) {
  const memberships = await platformDb.membership.findMany({
    where: { userId },
    select: { studio: { select: { status: true } } },
  });
  return memberships.length > 0 && memberships.every((row) => row.studio.status === "suspended");
}
