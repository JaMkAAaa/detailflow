import Decimal from "decimal.js";
import type { StudioStatus } from "@/lib/db/generated/client";
import { monthlyNet, type BillingSnapshot } from "@/lib/billing/catalog";

/** Netto PLN / miesiąc, wg audit/admin/README.md; nie suma pobranych płatności. */
export function calculateMrr(studios: Iterable<BillingSnapshot & { status: StudioStatus }>): Decimal {
  let total = new Decimal(0);
  for (const studio of studios) {
    if (studio.status === "active") total = total.plus(monthlyNet(studio));
  }
  return total;
}
