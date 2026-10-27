import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Integracje (Stripe, KSeF, e-mail, SMS, Sentry) są opcjonalne w szkielecie.
// Każde issue, które je wdraża, przenosi swoje zmienne do wymaganych.
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url(),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),

    S3_ENDPOINT: z.url(),
    // Adres S3 widoczny z przeglądarki (presigned URL). W Compose S3_ENDPOINT to host `minio`, więc lokalnie ustaw http://localhost:9000.
    S3_PUBLIC_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),

    AUTH_SECRET: z.string().min(32),

    STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
    STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),

    // TEST i PROD KSeF są rozdzielone; domyślnie zawsze test.
    KSEF_ENV: z.literal("test").default("test"),
    KSEF_API_URL: z.url().default("https://api-test.ksef.mf.gov.pl"),
    KSEF_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/).optional(),

    SMTP_URL: z.url().optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    SMSAPI_TOKEN: z.string().min(1).optional(),
    SENTRY_DSN: z.url().optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_").optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
