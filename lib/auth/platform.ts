import { authCounter } from "../../src/server/rate-limit";
import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { platformDb } from "../db/client";
import { PLATFORM_COOKIE_PREFIX } from "./cookie";
import { sendAuthMailInBackground } from "./email";
import { hashPassword, verifyPassword } from "./password";
import { PASSWORD_MIN_LENGTH } from "./password-policy";
import { loginLockoutHooks } from "./lockout";
import { env } from "../env";

async function assertOperator(userId: string) {
  const operator = await platformDb.platformOperator.findUnique({ where: { userId }, select: { id: true } });
  if (!operator) throw new APIError("FORBIDDEN", { message: "To konto nie ma dostępu do panelu platformy." });
}

// Osobna sesja panelu /admin: inne cookie niż studio, ten sam User/Account.
// Dostęp tylko z rekordem PlatformOperator — membership studia nic nie daje.
export const platformAuth = betterAuth({
  appName: "Detailflow Admin",
  baseURL: env.APP_URL,
  basePath: "/api/auth/platform",
  secret: env.AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(platformDb, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    password: { hash: hashPassword, verify: verifyPassword },
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const operator = await platformDb.platformOperator.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (!operator) return;
      sendAuthMailInBackground({
        to: user.email,
        subject: "Detailflow — ustaw nowe hasło (panel platformy)",
        text: `Ktoś poprosił o reset hasła do panelu właściciela Detailflow.\n\nUstaw nowe hasło (link ważny 60 min):\n${url}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    customStorage: authCounter("platform"),
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    cookiePrefix: PLATFORM_COOKIE_PREFIX,
    database: { generateId: false },
  },

  hooks: loginLockoutHooks("platform"),

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          await assertOperator(session.userId);
          return { data: session };
        },
      },
    },
  },

  plugins: [
    magicLink({
      disableSignUp: true,
      expiresIn: 15 * 60,
      storeToken: "hashed",
      sendMagicLink: async ({ email, url }) => {
        const user = await platformDb.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { id: true, platformOperator: { select: { id: true } } },
        });
        if (!user?.platformOperator) return;
        sendAuthMailInBackground({
          to: email,
          subject: "Detailflow — link do panelu platformy",
          text: `Zaloguj się do panelu właściciela Detailflow (link ważny 15 min, działa raz):\n${url}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type PlatformAuthSession = typeof platformAuth.$Infer.Session;
