// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Analytics } from "./Analytics";
import type { PlatformAnalytics } from "@/src/server/admin/analytics";

afterEach(cleanup);

const data: PlatformAnalytics = {
  periodLabel: "1–26 października 2026",
  activation: { activated: 24, eligible: 40, rate: 0.6 },
  conversion: { paid: 9, completed: 30, rate: 0.3 },
  cohorts: [
    {
      label: "20–26 paź",
      cells: [
        { rate: null, active: 0, observed: 0 },
        { rate: 0, active: 0, observed: 4 },
      ],
    },
  ],
  features: [
    { key: "orders", label: "Zlecenia", used: 10, eligible: 20, rate: 0.5 },
    { key: "quotes", label: "Wyceny", used: 0, eligible: 20, rate: 0 },
    { key: "portal", label: "Portal klienta", used: 0, eligible: 20, rate: 0 },
    { key: "photos", label: "Zdjęcia", used: 0, eligible: 20, rate: 0 },
    { key: "invoices", label: "Faktury PROD", used: 1, eligible: 20, rate: 0.05 },
  ],
};

it("pokazuje pauzę przy niepełnym oknie i 0% przy pełnym oknie bez zleceń", () => {
  render(<Analytics data={data} />);
  expect(screen.getByRole("heading", { name: "Analityka produktu" })).toBeTruthy();
  expect(screen.getByText(/KSeF TEST nie wchodzi w te wykresy/)).toBeTruthy();
  expect(screen.getByText("24 / 40 · ≥ 3 zlecenia w 7 dniach od rejestracji. Konto bez pełnego okna jest poza mianownikiem.")).toBeTruthy();
  expect(screen.getByText("9 / 30 zakończonych triali, nie bieżących")).toBeTruthy();
  const row = screen.getByRole("row", { name: /20–26 paź/ });
  expect(row.textContent).toContain("—");
  expect(row.textContent).toContain("0%");
  expect(screen.getByText("Faktury PROD")).toBeTruthy();
});
