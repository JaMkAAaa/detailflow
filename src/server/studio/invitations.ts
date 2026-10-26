import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { platformDb } from "../../../lib/db/client";
import { studioDb } from "../../../lib/db/tenant";
import { Prisma } from "../../../lib/db/generated/client";
import { sendAuthMail } from "../../../lib/auth/email";
import { env } from "../../../lib/env";
import { AccessError, authorizeStudio } from "../acl";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), role: z.enum(["manager", "worker"]) });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function inviteMember(userId: string, studioId: string, input: unknown) {
  const { db } = await authorizeStudio(userId, studioId, "members:invite");
  const { email, role } = schema.parse(input);
  // Konto bez hasła: zaproszony loguje się istniejącym flow magic link.
  // Nie zmieniamy danych ani roli istniejącego konta.
  await platformDb.user.upsert({ where: { email }, create: { email, name: email }, update: {} });
  const token = randomBytes(32).toString("hex");
  const invitation = await db.invitation.create({ data: {
    studioId, email, role, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 7 * 86400000),
  } });
  try {
    await sendAuthMail({ to: email, subject: "Detailflow — zaproszenie do studia",
      text: `Zaproszono Cię do studia w Detailflow (rola: ${role}).\n\nOtwórz link i zaloguj się adresem ${email} (możesz wybrać logowanie linkiem z e-maila):\n${new URL(`/invite/${token}`, env.APP_URL)}\n\nZaproszenie jest ważne 7 dni i działa raz.` });
  } catch (error) {
    await db.invitation.delete({ where: { id: invitation.id } });
    throw error;
  }
  return { id: invitation.id, expiresAt: invitation.expiresAt };
}

export async function acceptInvitation(user: { id: string; email: string }, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new AccessError(404, "Zaproszenie wygasło lub jest nieprawidłowe.");
  // Odkrycie tenanta po losowym tokenie to granica auth, nie operacyjne API.
  const invitation = await platformDb.invitation.findUnique({ where: { tokenHash: tokenHash(token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) throw new AccessError(404, "Zaproszenie wygasło lub jest nieprawidłowe.");
  if (invitation.email !== user.email.toLowerCase()) throw new AccessError(403, "Zaloguj się adresem, na który wysłano zaproszenie.");
  const db = studioDb(invitation.studioId);
  try {
    await db.$transaction([
      db.invitation.update({ where: { id: invitation.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } }),
      db.membership.upsert({ where: { studioId_userId: { studioId: invitation.studioId, userId: user.id } },
        create: { studioId: invitation.studioId, userId: user.id, role: invitation.role }, update: {} }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new AccessError(404, "Zaproszenie wygasło lub zostało wykorzystane.");
    throw error;
  }
  return invitation.studioId;
}
