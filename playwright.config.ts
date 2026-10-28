import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (!process.env.CI && existsSync(".env")) process.loadEnvFile(".env");

function localHost(url: string | undefined, fallback: string) {
  return (url && url.length > 0 ? url : fallback)
    .replaceAll("@postgres:", "@127.0.0.1:")
    .replaceAll("redis://redis:", "redis://127.0.0.1:")
    .replaceAll("://minio:", "://127.0.0.1:")
    .replaceAll("://mailpit:", "://127.0.0.1:");
}

process.env.DATABASE_URL = localHost(process.env.DATABASE_URL, "postgresql://detailflow:detailflow@127.0.0.1:5432/detailflow");
process.env.REDIS_URL = localHost(process.env.REDIS_URL, "redis://127.0.0.1:6379");
process.env.S3_ENDPOINT = localHost(process.env.S3_ENDPOINT, "http://127.0.0.1:9000");
process.env.S3_PUBLIC_ENDPOINT = localHost(process.env.S3_PUBLIC_ENDPOINT, "http://127.0.0.1:9000");
process.env.S3_REGION ??= "us-east-1";
process.env.S3_BUCKET ??= "detailflow";
process.env.S3_ACCESS_KEY ??= "detailflow";
process.env.S3_SECRET_KEY ??= "detailflow-dev-secret";
process.env.AUTH_SECRET ??= "dev-only-change-me-0123456789abcdef";
process.env.APP_URL = "http://127.0.0.1:3100";
process.env.STRIPE_SECRET_KEY = "sk_test_e2e_detailflow";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_e2e_detailflow";
process.env.STRIPE_API_HOST = "127.0.0.1";
process.env.STRIPE_API_PORT = "12119";
process.env.STRIPE_API_PROTOCOL = "http";
delete process.env.SKIP_ENV_VALIDATION;

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "golden",
      dependencies: ["setup"],
      testMatch: /.*\.spec\.ts/,
      use: { storageState: "e2e/.auth/studio.json" },
    },
  ],
  webServer: {
    command: "node e2e/web-server.mjs",
    url: `${baseURL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)),
  },
});
