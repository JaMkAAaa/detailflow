import type { PlatformCostCategory } from "@/lib/db/generated/client";

const MONEY = /^(?:0|[1-9]\d{0,9})(?:[.,]\d{1,2})?$/;

export const COST_CATEGORIES = ["infrastructure", "messaging", "support"] as const satisfies readonly PlatformCostCategory[];

export const COST_LABEL: Record<PlatformCostCategory, string> = {
  infrastructure: "Infrastruktura",
  messaging: "SMS i e-mail",
  support: "Wsparcie",
};

/** Kwota netto jako string `Decimal`. Puste pole = 0. Odrzuca ułamki i więcej niż 2 miejsca. */
export function parseCostAmount(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s/g, "");
  if (trimmed === "") return "0.00";
  if (!MONEY.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.replace(",", ".").split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
