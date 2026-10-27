import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Testy bazodanowe wymagają DATABASE_URL (lokalnie: localhost:5433 z Compose, w CI: serwis postgres).
// Ładujemy `.env`, żeby `pnpm test` działał po samym `cp .env.example .env`.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "dist"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
