/** Wpływy makiety A-04: pobrane płatności netto 1–26 października = 14 980 zł. */
export const DEMO_OCTOBER_RECEIPTS = [
  ...Array.from({ length: 50 }, () => "149.00"),
  ...Array.from({ length: 40 }, () => "79.00"),
  ...Array.from({ length: 15 }, () => "279.00"),
  "185.00",
] as const;

export const DEMO_OCTOBER_COSTS = [
  { category: "infrastructure" as const, amountNet: "1860.00" },
  { category: "messaging" as const, amountNet: "1300.00" },
  { category: "support" as const, amountNet: "1100.00" },
];
