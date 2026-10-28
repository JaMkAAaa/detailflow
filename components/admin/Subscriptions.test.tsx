// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

import { Subscriptions } from "./Subscriptions";
import type { PlatformSubscriptions } from "@/src/server/admin/subscriptions";

afterEach(cleanup);

const data: PlatformSubscriptions = {
  periodLabel: "1–26 października 2026",
  monthLabel: "październik 2026",
  mrr: "16672.00",
  composition: [
    { plan: "solo", label: "Solo", count: 64, unit: "79.00", amount: "5056.00", share: 30.3 },
    { plan: "studio", label: "Studio", count: 48, unit: "149.00", amount: "7152.00", share: 42.9 },
    { plan: "pro", label: "Pro", count: 16, unit: "279.00", amount: "4464.00", share: 26.8 },
  ],
  collected: "14980.00",
  arrears: { count: 6, amount: "894.00" },
  arrearsRows: [{ id: "1", name: "Studio Demo", publicCode: "ST-D0001", plan: "Studio", amount: "149.00" }],
  churn: { base: 118, left: 5, joined: 15, paying: 128, rate: 5 / 118 },
  costs: [
    { category: "infrastructure", amount: "1860.00" },
    { category: "messaging", amount: "1300.00" },
    { category: "support", amount: "1100.00" },
  ],
  costTotal: "4260.00",
  costsEntered: true,
  marginLabel: "74,4%",
  marginWidth: 74.4,
};

it("pokazuje skład MRR, wpływy, zaległość i churn 4,2%", () => {
  render(<Subscriptions data={data} canEdit />);
  expect(screen.getByRole("heading", { name: "Abonamenty i przychody" })).toBeTruthy();
  expect(screen.getByText("16 672 zł")).toBeTruthy();
  expect(screen.getByText("14 980 zł")).toBeTruthy();
  expect(screen.getByText("894 zł")).toBeTruthy();
  expect(screen.getAllByText("4,2%").length).toBeGreaterThan(0);
  expect(screen.getByText("5 / 118 płacących na początku miesiąca")).toBeTruthy();
  expect(screen.getByText("64 × 79 zł")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Studio Demo/ })).toBeTruthy();
  expect(screen.getByLabelText("Infrastruktura")).toBeTruthy();
  expect(screen.getByText("74,4%", { exact: false })).toBeTruthy();
});
