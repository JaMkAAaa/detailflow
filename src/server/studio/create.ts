import { randomUUID } from "node:crypto";
import { z } from "zod";
import { platformDb } from "../../../lib/db/client";
import { Prisma } from "../../../lib/db/generated/client";
import { hashPassword } from "../../../lib/auth/password";
import { PASSWORD_MIN_LENGTH } from "../../../lib/auth/password-policy";

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  studioName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(128),
});

export class SignupError extends Error {}

/** Provisioning auth: jeden atomowy zapis platformowy przed powstaniem tenanta. */
export async function createTrialStudio(input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) throw new SignupError("Sprawdź dane formularza. Hasło musi mieć od 10 do 128 znaków.");
  const { name, studioName, email, password } = parsed.data;
  const studioId = randomUUID();
  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date();

  try {
    // Unikalny User.email rozstrzyga również równoległe rejestracje. Błąd
    // wycofuje całość, w tym Studio. Membership dostaje jawny studioId.
    const [studio, user] = await platformDb.$transaction([
      platformDb.studio.create({
        data: {
          id: studioId,
          publicCode: `ST-${studioId}`,
          slug: `studio-${studioId}`,
          name: studioName,
          status: "trial",
          plan: "solo",
          trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      }),
      platformDb.user.create({
        data: {
          id: userId, name, email,
          accounts: { create: { providerId: "credential", accountId: userId, password: passwordHash } },
          memberships: { create: { studioId, role: "owner" } },
        },
        select: { id: true },
      }),
    ]);
    return { studio, userId: user.id, email };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" &&
      await platformDb.user.findUnique({ where: { email }, select: { id: true } })) {
      throw new SignupError("Konto z tym adresem e-mail już istnieje. Zaloguj się.");
    }
    throw error;
  }
}
