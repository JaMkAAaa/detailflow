import { hashPortalToken } from "../../lib/portal/token";

/** UI-only P-01/P-02 fixtures. No operational queries; time frozen at 24.10.2026, 11:30. */
export const portalDemo = {
  studio: {
    name: "OBSIDIAN STUDIO",
    // Demonstration contact, not a live studio integration.
    phone: "+48500100200",
    email: "obsidian@example.com",
  },
  customerFirstName: "Adam",
  vehicle: "Porsche Panamera",
  plate: "WA 911PC",
  orderNumber: "DF-0248",
  grossPln: "4800.00",
  stages: [
    { name: "Przyjęcie i mycie", note: "Zakończono dziś, 09:15", state: "done", symbol: "✓" },
    { name: "Korekta lakieru", note: "Pracujemy nad idealnym połyskiem", state: "current", symbol: "●" },
    { name: "Ceramika i kontrola", note: "Kolejny etap", state: "todo", symbol: "○" },
  ],
} as const;

// Same demo links as prisma/seed.ts. Keep only hashes in the resolver.
const ACTIVE_HASH = "9a46c6a2a3530cf44ecafcf2ee0bdd4c5835a667c9671f66a6b79b226abd63ca";
const EXPIRED_HASH = "78bfdc9a16ce8ded454241db45014265c6b013c50610ec6e8623a443bcf33c21";

export function resolvePortalDemo(token: string) {
  const hash = hashPortalToken(token);
  if (hash === ACTIVE_HASH) return "active";
  if (hash === EXPIRED_HASH) return "expired";
  return "unknown";
}
