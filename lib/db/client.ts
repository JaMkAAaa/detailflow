import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

// Klient bez filtra tenant. Tylko dla: panelu platformy (z wpisem w AuditLog),
// auth, webhooków Stripe i seeda. Kod studia używa `studioDb(studioId)`.

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { platformDb?: ReturnType<typeof createClient> };

export const platformDb = globalForPrisma.platformDb ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.platformDb = platformDb;

export type PlatformDb = typeof platformDb;
