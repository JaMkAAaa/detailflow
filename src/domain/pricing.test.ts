import { describe, expect, it } from "vitest";
import { Decimal } from "@prisma/client/runtime/client";
import { calculatePricing, type PricingInput, type VehicleSize } from "./pricing";

const decimal = (value: string) => new Decimal(value);
const service = (price: string, durationMin: number | null = 60) => ({
  basePrice: decimal(price), durationMin,
});
const input = (overrides: Partial<PricingInput> = {}): PricingInput => ({
  services: [service("4000.00")], size: "medium", paintMult: decimal("1.0"), ...overrides,
});

describe("calculatePricing", () => {
  it("calculates the documented quote and VAT included in gross using Decimal", () => {
    const result = calculatePricing(input());
    expect(result.totalGross).toBeInstanceOf(Decimal);
    expect(result.vatAmount).toBeInstanceOf(Decimal);
    expect(result.totalGross.toFixed(2)).toBe("4800.00");
    expect(result.vatAmount.toFixed(2)).toBe("897.56");
    expect(result.durationMin).toBe(72);
  });

  it.each([
    ["small", "4000.00", 60],
    ["medium", "4800.00", 72],
    ["suv", "5400.00", 81],
  ] as const)("recalculates price and time for %s", (size, gross, minutes) => {
    const result = calculatePricing(input({ size }));
    expect(result.totalGross.toFixed(2)).toBe(gross);
    expect(result.durationMin).toBe(minutes);
  });

  it("returns zero amounts and time for no services", () => {
    const result = calculatePricing(input({ services: [] }));
    expect(result.totalGross.toFixed(2)).toBe("0.00");
    expect(result.vatAmount.toFixed(2)).toBe("0.00");
    expect(result.durationMin).toBe(0);
  });

  it("sums three services before applying size and a non-unit paint multiplier", () => {
    const result = calculatePricing(input({
      services: [service("1000.10", 100), service("2000.20", 200), service("999.70", 50)],
      paintMult: decimal("1.15"),
    }));
    expect(result.totalGross.toFixed(2)).toBe("5520.00");
    expect(result.vatAmount.toFixed(2)).toBe("1032.20");
    expect(result.durationMin).toBe(420);
  });

  it("rounds the aggregate gross half up, then extracts VAT from the rounded gross", () => {
    const result = calculatePricing(input({
      services: [service("0.01", 1), service("0.01", 1), service("0.01", 1)],
      size: "small", paintMult: decimal("1.5"),
    }));
    expect(result.totalGross.toFixed(2)).toBe("0.05");
    expect(result.vatAmount.toFixed(2)).toBe("0.01");
    expect(result.durationMin).toBe(3);
  });

  it.each([["0.02", "0.00"], ["0.03", "0.01"]])("rounds VAT to grosze for gross %s", (gross, vat) => {
    expect(calculatePricing(input({ services: [service(gross)], size: "small" }))
      .vatAmount.toFixed(2)).toBe(vat);
  });

  it("keeps large PLN amounts precise to the grosz", () => {
    const result = calculatePricing(input({ services: [service("9999999999.99")], size: "small" }));
    expect(result.totalGross.toFixed(2)).toBe("9999999999.99");
    expect(result.vatAmount.toFixed(2)).toBe("1869918699.19");
  });

  it("rounds total time up once, after summing services", () => {
    expect(calculatePricing(input({ services: [service("1", 1), service("1", 1)] }))
      .durationMin).toBe(3);
  });

  it("preserves unknown service duration", () => {
    const result = calculatePricing(input({ services: [service("100", null), service("100", 20)] }));
    expect(result.durationMin).toBeNull();
    expect(result.totalGross.toFixed(2)).toBe("240.00");
  });

  it("does not mutate inputs across repeated size changes", () => {
    const services = Object.freeze([Object.freeze(service("100.01", 61))]);
    const paintMult = decimal("1.1");
    const before = calculatePricing(input({ services, paintMult, size: "small" }));
    calculatePricing(input({ services, paintMult, size: "suv" }));
    const after = calculatePricing(input({ services, paintMult, size: "small" }));
    expect(after).toEqual(before);
    expect(services[0]!.basePrice.toFixed(2)).toBe("100.01");
    expect(paintMult.toString()).toBe("1.1");
  });

  it.each(["-1", "NaN", "Infinity"])("rejects invalid base price %s", (price) => {
    expect(() => calculatePricing(input({ services: [service(price)] }))).toThrow(RangeError);
  });

  it.each(["0", "-1", "NaN", "Infinity"])("rejects invalid paint multiplier %s", (value) => {
    expect(() => calculatePricing(input({ paintMult: decimal(value) }))).toThrow(RangeError);
  });

  it("rejects JS numbers for monetary input at runtime", () => {
    expect(() => calculatePricing(input({
      services: [{ basePrice: 0.1 as unknown as Decimal, durationMin: 1 }],
    }))).toThrow(RangeError);
    expect(() => calculatePricing(input({ paintMult: 1.2 as unknown as Decimal }))).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid duration %s", (minutes) => {
    expect(() => calculatePricing(input({ services: [service("1", minutes)] }))).toThrow(RangeError);
  });

  it("rejects unknown sizes and unsafe calculated durations", () => {
    expect(() => calculatePricing(input({ size: "large" as VehicleSize }))).toThrow(RangeError);
    expect(() => calculatePricing(input({ services: [service("1", Number.MAX_SAFE_INTEGER)] })))
      .toThrow(RangeError);
  });
});
