import { describe, expect, it } from "vitest";
import { calculateMrr } from "./mrr";
import { restrictedMessage } from "./access";

describe("MRR wg audit/admin/README.md", () => {
  it("sumuje 128 aktywnych kont do 16 672 PLN, pomija triale, zaległości i wstrzymane", () => {
    const studios = [
      ...Array.from({ length: 64 }, () => ({ status: "active", plan: "solo" } as const)),
      ...Array.from({ length: 48 }, () => ({ status: "active", plan: "studio" } as const)),
      ...Array.from({ length: 16 }, () => ({ status: "active", plan: "pro" } as const)),
      ...Array.from({ length: 24 }, () => ({ status: "trial", plan: "studio" } as const)),
      ...Array.from({ length: 6 }, () => ({ status: "past_due", plan: "studio" } as const)),
      ...Array.from({ length: 8 }, () => ({ status: "suspended", plan: "pro" } as const)),
      { status: "canceled", plan: "pro" } as const,
    ];
    expect(calculateMrr(studios).toFixed(2)).toBe("16672.00");
    expect(calculateMrr([]).toFixed(2)).toBe("0.00");
  });
  it("odcina trial dokładnie w chwili końca, nawet przed cronem", () => {
    const now = new Date("2026-10-27T12:00:00Z");
    expect(restrictedMessage({ status: "trial", trialEndsAt: new Date(now.getTime() + 1) }, now)).toBeNull();
    expect(restrictedMessage({ status: "trial", trialEndsAt: now }, now)).toContain("zakończył");
    expect(restrictedMessage({ status: "trial", trialEndsAt: null }, now)).toBeTruthy();
    expect(restrictedMessage({ status: "active", trialEndsAt: now }, now)).toBeNull();
    for (const status of ["past_due", "suspended", "canceled"] as const) expect(restrictedMessage({ status, trialEndsAt: null }, now)).toBeTruthy();
  });
});
