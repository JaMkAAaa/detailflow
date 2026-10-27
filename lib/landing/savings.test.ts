import { describe, expect, it } from "vitest";
import { estimateSavings } from "./savings";
import { planForBays } from "./plans";

describe("estimateSavings", () => {
  it("reproduces the Figma L-01 example (2 bays, Studio plan)", () => {
    expect(estimateSavings({ carsPerWeek: 18, averageOrderPln: 850, paperworkHoursPerWeek: 9, bays: 2 })).toEqual({
      hoursSavedPerMonth: 27,
      extraCars: 4,
      extraRevenuePln: "3400.00",
      plan: { id: "studio", name: "Studio", priceNetPln: "149", maxBays: 4 },
      returnMultiple: 23,
    });
  });

  it("keeps money exact, without float drift", () => {
    expect(estimateSavings({ carsPerWeek: 30, averageOrderPln: 1234.5, paperworkHoursPerWeek: 0, bays: 1 }).extraRevenuePln).toBe(
      "7407.00",
    );
  });

  it("picks the plan by bays", () => {
    expect([1, 2, 4, 5, 12].map((bays) => planForBays(bays).id)).toEqual(["solo", "studio", "studio", "pro", "pro"]);
  });
});
