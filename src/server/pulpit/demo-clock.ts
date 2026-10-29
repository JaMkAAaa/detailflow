import { platformDb } from "../../../lib/db/client";

// „Teraz” makiety D-01: 24.10.2026, 11:30 czasu Warszawy. Ten sam instant co DEMO.now w seedzie.
const DEMO_DASHBOARD_AT = new Date("2026-10-24T09:30:00.000Z");

/** Zegar widoków: studio demo (Obsidian) stoi na dacie makiety, każde inne studio na prawdziwym „teraz”. */
export async function studioNow(studioId: string) {
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { slug: true } });
  return studio?.slug === "obsidian-studio" ? DEMO_DASHBOARD_AT : new Date();
}
