import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { subscriptionInvoiceNet } from "../billing/revenue";
import { DEMO_OCTOBER_RECEIPTS } from "./demo-receipts";
import { parseCostAmount } from "./costs";
import {
  arrears,
  churnStats,
  cohortRetention,
  formatRate,
  mrrByPlan,
  operatingMargin,
  startOfWarsawMonth,
  startOfWarsawWeek,
  type StudioSnapshot,
} from "./metrics";

const now = new Date("2026-10-26T10:30:00.000Z");

function studio(over: Partial<StudioSnapshot> & Pick<StudioSnapshot, "id">): StudioSnapshot {
  return {
    name: "S",
    publicCode: "ST",
    status: "active",
    plan: "studio",
    createdAt: new Date("2025-06-01T08:00:00.000Z"),
    updatedAt: now,
    activatedAt: new Date("2025-06-01T08:00:00.000Z"),
    trialEndsAt: null,
    ...over,
  };
}

describe("A-04 i A-05 wg audit/admin", () => {
  it("rozbija MRR na 64×79, 48×149 i 16×279", () => {
    const studios = [
      ...Array.from({ length: 64 }, () => ({ status: "active" as const, plan: "solo" as const })),
      ...Array.from({ length: 48 }, () => ({ status: "active" as const, plan: "studio" as const })),
      ...Array.from({ length: 16 }, () => ({ status: "active" as const, plan: "pro" as const })),
      ...Array.from({ length: 6 }, () => ({ status: "past_due" as const, plan: "studio" as const })),
      ...Array.from({ length: 24 }, () => ({ status: "trial" as const, plan: "studio" as const })),
    ];
    const composition = mrrByPlan(studios);
    expect(composition.total.toFixed(2)).toBe("16672.00");
    expect(composition.rows.map((row) => [row.plan, row.count, row.amount.toFixed(2)])).toEqual([
      ["solo", 64, "5056.00"],
      ["studio", 48, "7152.00"],
      ["pro", 16, "4464.00"],
    ]);
    expect(arrears(studios).count).toBe(6);
    expect(arrears(studios).total.toFixed(2)).toBe("894.00");
  });

  it("liczy churn 5/118 i pomija nieudany trial oraz zaległość sprzed miesiąca", () => {
    const old = new Date("2025-06-01T08:00:00.000Z");
    const studios = [
      ...Array.from({ length: 113 }, (_, index) => studio({ id: `a${index}`, createdAt: old, activatedAt: old })),
      ...Array.from({ length: 5 }, (_, index) => studio({
        id: `c${index}`, status: "canceled", createdAt: old, activatedAt: old, updatedAt: new Date("2026-10-12T08:00:00.000Z"),
      })),
      ...Array.from({ length: 15 }, (_, index) => studio({
        id: `n${index}`,
        createdAt: new Date("2026-10-08T08:00:00.000Z"),
        activatedAt: new Date("2026-10-08T08:00:00.000Z"),
      })),
      ...Array.from({ length: 21 }, (_, index) => studio({
        id: `t${index}`, status: "canceled", plan: "solo", activatedAt: null,
        createdAt: new Date("2026-08-20T08:00:00.000Z"), updatedAt: new Date("2026-09-15T08:00:00.000Z"),
        trialEndsAt: new Date("2026-09-15T08:00:00.000Z"),
      })),
      ...Array.from({ length: 6 }, (_, index) => studio({
        id: `p${index}`, status: "past_due", createdAt: old, activatedAt: old, updatedAt: new Date("2026-09-20T08:00:00.000Z"),
      })),
    ];
    expect(churnStats(studios, now)).toMatchObject({ base: 118, left: 5, joined: 15, paying: 128, rate: 5 / 118 });
    expect(formatRate(5 / 118)).toBe("4,2%");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(null)).toBe("—");
  });

  it("sumuje wpływy makiety do 14 980 i marżę po kosztach do 74,4%", () => {
    const collected = DEMO_OCTOBER_RECEIPTS.reduce((sum, amount) => sum.plus(amount), new Decimal(0));
    expect(collected.toFixed(2)).toBe("14980.00");
    const margin = operatingMargin(new Decimal("16672.00"), new Decimal("4260.00"));
    expect(formatRate(margin)).toBe("74,4%");
    expect(operatingMargin(new Decimal(0), new Decimal(0))).toBeNull();
  });

  it("bierze netto z faktury Stripe, nie brutto amount_paid", () => {
    expect(subscriptionInvoiceNet({ currency: "pln", amount_paid: 18327, total_excluding_tax: 14900 })!.toFixed(2)).toBe("149.00");
    expect(subscriptionInvoiceNet({ currency: "pln", amount_paid: 18327, subtotal: 14900, total_excluding_tax: 7900 })!.toFixed(2)).toBe("79.00");
    expect(subscriptionInvoiceNet({ currency: "eur", amount_paid: 14900, total_excluding_tax: 14900 })).toBeNull();
    expect(subscriptionInvoiceNet({ currency: "pln", amount_paid: 0, total_excluding_tax: 14900 })).toBeNull();
  });

  it("przyjmuje ręczny koszt jako Decimal i odrzuca ułamek", () => {
    expect(parseCostAmount("1 860,5")).toBe("1860.50");
    expect(parseCostAmount("")).toBe("0.00");
    expect(parseCostAmount("1.239")).toBeNull();
    expect(parseCostAmount("-1")).toBeNull();
  });

  it("kohorta bez pełnego okna jest „—”, a pełne okno bez zleceń jest 0%", () => {
    expect(startOfWarsawMonth(now).toISOString()).toBe("2026-09-30T22:00:00.000Z");
    expect(startOfWarsawWeek(now).toISOString()).toBe("2026-10-25T23:00:00.000Z");

    const fresh = new Date("2026-10-26T08:00:00.000Z");
    const open = cohortRetention(
      [{ id: "fresh", createdAt: fresh }],
      [{ studioId: "fresh", createdAt: fresh, updatedAt: fresh }],
      now,
    );
    expect(open.at(-1)!.cells[0]).toMatchObject({ rate: null, observed: 0, active: 0 });

    const born = new Date("2026-10-12T08:00:00.000Z");
    const order = new Date("2026-10-20T08:00:00.000Z");
    const row = cohortRetention(
      [{ id: "s", createdAt: born }],
      [{ studioId: "s", createdAt: order, updatedAt: order }],
      now,
    ).find((item) => item.cells.some((cell) => cell.observed > 0));
    expect(row?.cells[0]).toMatchObject({ rate: 0, observed: 1, active: 0 });
    expect(row?.cells[1]).toMatchObject({ rate: 1, observed: 1, active: 1 });
    expect(row?.cells[2]).toMatchObject({ rate: null, observed: 0 });
    expect(formatRate(row!.cells[2]!.rate)).toBe("—");
    expect(formatRate(row!.cells[0]!.rate)).toBe("0%");
  });
});
