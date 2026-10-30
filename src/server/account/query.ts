import { platformDb } from "@/lib/db/client";

// Dane tożsamości (jak Better Auth), nie operacje studia. Wyłącznie ID z sesji.
export async function readOwnAccount(userId: string, sessionId: string) {
  const [user, sessions] = await Promise.all([
    platformDb.user.findUniqueOrThrow({
      where: { id: userId }, select: { email: true, name: true, trialReminderEnabled: true },
    }),
    platformDb.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    ...user,
    sessions: sessions.map(({ id, createdAt, expiresAt, ...session }) => ({
      ...session, id, current: id === sessionId,
      createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString(),
    })),
  };
}
export type OwnAccount = Awaited<ReturnType<typeof readOwnAccount>>;
