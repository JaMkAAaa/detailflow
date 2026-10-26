import { defineConfig } from "prisma/config";

// Prisma 7 nie czyta `.env` sam. W kontenerze `web` DATABASE_URL jest już
// w środowisku; na hoście ustaw go ręcznie (localhost zamiast `postgres`).
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
