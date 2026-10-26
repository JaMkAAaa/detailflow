import { defineConfig } from "vitest/config";

// Testy bazodanowe wymagają DATABASE_URL (lokalnie: localhost:5433 z Compose, w CI: serwis postgres).
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "dist"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
