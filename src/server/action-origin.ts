import { headers } from "next/headers";

export function sameOrigin(origin: string | null, appUrl: string) {
  if (!origin) return false;
  try { return origin === new URL(appUrl).origin; }
  catch { return false; }
}

/** Server Actions Next sprawdzają Origin. Ten warunek jest drugi, jawny, i pada przy braku nagłówka. */
export async function assertActionOrigin() {
  const { env } = await import("../../lib/env");
  const origin = (await headers()).get("origin");
  if (!sameOrigin(origin, env.APP_URL)) throw new Error("Niedozwolone źródło żądania.");
}
