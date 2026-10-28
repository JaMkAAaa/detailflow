import { APIError } from "better-auth/api";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { platformDb } from "./db/client";
import { AUTH_COOKIE_PREFIX } from "./auth/cookie";
import { sendAuthMailInBackground } from "./auth/email";
import { studioLoginBlocked } from "../src/server/studio/login-gate";
import { hashPassword, verifyPassword } from "./auth/password";
import { PASSWORD_MIN_LENGTH } from "./auth/password-policy";
import { env } from "./env";

// Auth studia: e-mail + hasło (Argon2id) albo magiczny link. Sesje w Postgres
// (model Session), cookie httpOnly. Konta zakłada rejestracja trialu (#24)
// i zaproszenia (#25), więc publiczny sign-up jest tu wyłączony.
// Panel platformy: osobna instancja Better Auth w lib/auth/platform.ts (#52).

export const auth = betterAuth({
  appName: "Detailflow",
  baseURL: env.APP_URL,
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
    // Better Auth odpowiada tak samo dla istniejącego i nieznanego e-maila;
    // wysyłka w tle, żeby czas odpowiedzi też tego nie zdradzał.
    sendResetPassword: async ({ user, url }) => {
      sendAuthMailInBackground({
        to: user.email,
        subject: "Detailflow — ustaw nowe hasło",
        text: `Ktoś poprosił o reset hasła do Detailflow.\n\nUstaw nowe hasło (link ważny 60 min):\n${url}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
      });
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    // Pamięć procesu: wystarcza przy jednym kontenerze web. Przy skalowaniu → Redis.
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
    },
  },

  advanced: {
    cookiePrefix: AUTH_COOKIE_PREFIX,
    database: { generateId: false },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (await studioLoginBlocked(session.userId)) {
            throw new APIError("FORBIDDEN", { message: "Konto studia jest wstrzymane. Skontaktuj się ze wsparciem." });
          }
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
        // Link tylko do istniejących kont; odpowiedź endpointu jest zawsze ta sama.
        const user = await platformDb.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
        if (!user) return;
        sendAuthMailInBackground({
          to: email,
          subject: "Detailflow — link do logowania",
          text: `Zaloguj się do Detailflow (link ważny 15 min, działa raz):\n${url}\n\nJeśli to nie Ty, zignoruj tę wiadomość.`,
        });
      },
    }),
    // Musi być ostatni: ustawia cookies z wywołań auth.api w Server Actions.
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
