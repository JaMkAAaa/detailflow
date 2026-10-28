import { platformDb } from "@/lib/db/client";

export async function checkDatabase() {
  await platformDb.$queryRaw`SELECT 1`;
}
