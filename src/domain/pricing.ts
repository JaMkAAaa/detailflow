import { Decimal } from "@prisma/client/runtime/client";

const SIZE_MULTIPLIERS = {
  small: "1.0",
  medium: "1.2",
  suv: "1.35",
} as const;

export type VehicleSize = keyof typeof SIZE_MULTIPLIERS;

export interface PricingService {
  /** Cena bazowa brutto w PLN. Kwoty przyjmujemy wyłącznie jako Decimal. */
  readonly basePrice: Decimal;
  /** Brak czasu dowolnej usługi oznacza nieznany czas całej wyceny. */
  readonly durationMin: number | null;
}

export interface PricingInput {
  readonly services: readonly PricingService[];
  readonly size: VehicleSize;
  readonly paintMult: Decimal;
}

export interface PricingResult {
  readonly totalGross: Decimal;
  readonly vatAmount: Decimal;
  readonly durationMin: number | null;
}

function validateDecimal(value: Decimal, name: string, positive = false) {
  if (
    !Decimal.isDecimal(value) ||
    !value.isFinite() ||
    (positive ? value.lte("0") : value.lt("0"))
  ) {
    throw new RangeError(`${name} must be a finite ${positive ? "positive" : "non-negative"} Decimal`);
  }
}

/**
 * Czysty silnik wyceny, PLN (dokumentacja §5.3).
 * Brutto = suma baz × rozmiar × lakier. Zaokrąglamy dopiero sumę do groszy,
 * ROUND_HALF_UP (dokładnie pół grosza w górę). VAT = zaokrąglone brutto × 23/123,
 * również ROUND_HALF_UP do groszy — VAT jest już zawarty w cenie.
 * Czas = suma minut × rozmiar, w górę do pełnej minuty. Lakier nie zmienia czasu.
 * Nie zmieniamy wejścia ani globalnej konfiguracji Decimal.
 */
export function calculatePricing({ services, size, paintMult }: PricingInput): PricingResult {
  if (!Object.hasOwn(SIZE_MULTIPLIERS, size)) {
    throw new RangeError("Unknown vehicle size");
  }
  validateDecimal(paintMult, "paintMult", true);
  const sizeMult = new Decimal(SIZE_MULTIPLIERS[size]);
  let baseTotal = new Decimal("0");
  let baseMinutes = new Decimal("0");
  let hasUnknownDuration = false;

  for (const service of services) {
    validateDecimal(service.basePrice, "basePrice");
    baseTotal = baseTotal.plus(service.basePrice);
    if (service.durationMin === null) {
      hasUnknownDuration = true;
    } else {
      if (!Number.isSafeInteger(service.durationMin) || service.durationMin < 0) {
        throw new RangeError("durationMin must be a non-negative safe integer or null");
      }
      baseMinutes = baseMinutes.plus(service.durationMin.toString());
    }
  }

  const totalGross = baseTotal.times(sizeMult).times(paintMult)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const vatAmount = totalGross.times("23").div("123")
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const minutes = baseMinutes.times(sizeMult).ceil();
  if (!hasUnknownDuration && minutes.gt(Number.MAX_SAFE_INTEGER.toString())) {
    throw new RangeError("Calculated duration exceeds safe integer range");
  }

  return {
    totalGross,
    vatAmount,
    durationMin: hasUnknownDuration ? null : minutes.toNumber(),
  };
}
