import Decimal from "decimal.js";
import type { Plan, StudioStatus } from "@/lib/db/generated/client";
import { BILLING_PLANS } from "./plans";

/** Netto PLN / miesiąc, wg audit/admin/README.md; nie suma pobranych płatności. */
export function calculateMrr(studios: Iterable<{ status: StudioStatus; plan: Plan }>): Decimal {
  let total = new Decimal(0);
  for (const studio of studios) {
    if (studio.status === "active") total = total.plus(new Decimal(BILLING_PLANS[studio.plan].unitAmount).div(100));
  }
  return total;
}
