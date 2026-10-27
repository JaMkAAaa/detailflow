import Decimal from "decimal.js";
import { planForBays, type LandingPlan } from "./plans";

/**
 * Kalkulator z landingu to ESTYMACJA na założeniach poniżej, nie pomiar wyników klientów
 * (docs §4.1). Założenia są pokazywane użytkownikowi i czekają na akceptację prawną.
 */
export const ASSUMPTIONS = {
  weeksPerMonth: new Decimal("4.33"),
  paperworkSavedShare: new Decimal("0.7"),
  extraVisitsShare: new Decimal("0.05"),
} as const;

export type SavingsInput = {
  carsPerWeek: number;
  averageOrderPln: number;
  paperworkHoursPerWeek: number;
  bays: number;
};

export type SavingsEstimate = {
  hoursSavedPerMonth: number;
  extraCars: number;
  /** PLN, dziesiętny string z dwoma miejscami. */
  extraRevenuePln: string;
  plan: LandingPlan;
  /** Krotność zwrotu abonamentu, zaokrąglona do całości. */
  returnMultiple: number;
};

export function estimateSavings(input: SavingsInput): SavingsEstimate {
  const { weeksPerMonth, paperworkSavedShare, extraVisitsShare } = ASSUMPTIONS;
  const hoursSavedPerMonth = new Decimal(input.paperworkHoursPerWeek)
    .times(weeksPerMonth)
    .times(paperworkSavedShare)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const extraCars = new Decimal(input.carsPerWeek)
    .times(weeksPerMonth)
    .times(extraVisitsShare)
    .toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const extraRevenue = extraCars.times(input.averageOrderPln);
  const plan = planForBays(input.bays);
  return {
    hoursSavedPerMonth: hoursSavedPerMonth.toNumber(),
    extraCars: extraCars.toNumber(),
    extraRevenuePln: extraRevenue.toFixed(2),
    plan,
    returnMultiple: extraRevenue.div(plan.priceNetPln).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(),
  };
}
