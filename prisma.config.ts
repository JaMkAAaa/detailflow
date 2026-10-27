import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 nie czyta `.env` sam. Ładujemy go, żeby `pnpm db:migrate` i
// `pnpm db:seed` działały z hosta bez ręcznego exportu. W kontenerze `web`
// DATABASE_URL jest już w środowisku, a `.env` zwykle nie trafia do obrazu.
if (!process.env.DATABASE_URL && existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `prisma generate` nie potrzebuje bazy, więc pusty URL wystarcza w CI/Dockerze.
    url: process.env.DATABASE_URL ?? "",
  },
});
