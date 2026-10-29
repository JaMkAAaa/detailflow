// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { Statistics } from "@/src/server/statystyki/statistics";
import { StatisticsScreen } from "./StatisticsScreen";

afterEach(cleanup);
const presets = [{ label: "Ten miesiąc", from: "2026-10-01", to: "2026-10-24" }];
const empty: Statistics = {
  range: { from: "2026-10-01", to: "2026-10-24", days: 24 },
  revenue: { hasData: false, totalPln: null, orders: 0, months: [{ key: "2026-10", label: "październik 2026", from: "2026-10-01", to: "2026-10-24", partial: true, hasData: false, revenuePln: null, orders: 0 }] },
  services: { hasData: false, orders: 0, rows: [] },
  occupancy: { hasData: false, percent: null, bookedHours: 0, capacityHours: 0, windowLabel: "08:00–16:00", bays: [] },
};
const full: Statistics = {
  range: { from: "2026-09-01", to: "2026-10-24", days: 54 },
  revenue: { hasData: true, totalPln: "12345.60", orders: 7, months: [
    { key: "2026-09", label: "wrzesień 2026", from: "2026-09-01", to: "2026-09-30", partial: false, hasData: true, revenuePln: "12345.60", orders: 7 },
    { key: "2026-10", label: "październik 2026", from: "2026-10-01", to: "2026-10-24", partial: true, hasData: false, revenuePln: null, orders: 0 },
  ] },
  services: { hasData: true, orders: 7, rows: [{ label: "Ceramika", orders: 7, orderShare: "100.0", revenuePln: "12345.60", revenueShare: "100.0" }] },
  occupancy: { hasData: true, percent: "31.3", bookedHours: 10, capacityHours: 32, windowLabel: "08:00–16:00", bays: [{ id: "b1", name: "Boks 01", percent: "62.5", bookedHours: 10, capacityHours: 16 }] },
};

it("shows 'Brak danych' instead of 0 zł / 0% when there is nothing to measure", () => {
  render(<StatisticsScreen data={empty} presets={presets} />);
  expect(screen.getAllByText("Brak danych")).toHaveLength(3);
  expect(screen.queryByText(/^0([,.]\d+)? zł$/)).toBeNull();
  expect(screen.queryByText(/^0%$/)).toBeNull();
  expect(screen.getAllByRole("status")).toHaveLength(3);
});

it("renders PLN, shares, occupancy and marks an empty month as data-less next to a measured one", () => {
  render(<StatisticsScreen data={full} presets={presets} />);
  const kpis = within(screen.getByRole("region", { name: "Wskaźniki" }));
  expect(kpis.getByText("12 345,60 zł")).toBeTruthy();
  expect(kpis.getByText("31,3%")).toBeTruthy();
  const months = within(screen.getByRole("heading", { name: "Przychód wg miesięcy" }).closest("section")!);
  expect(months.getByText(/wrzesień 2026/)).toBeTruthy();
  expect(months.getByText("Brak danych")).toBeTruthy();
  expect(months.getByText(/część miesiąca: 01.10.2026 – 24.10.2026/)).toBeTruthy();
  expect(screen.getByText("Ceramika")).toBeTruthy();
  expect(screen.getByText("Boks 01")).toBeTruthy();
});

it("has a GET date form with the current range, presets and a validation message", () => {
  render(<StatisticsScreen data={full} presets={presets} error="Podaj daty w formacie RRRR-MM-DD." />);
  const form = screen.getByRole("form", { name: "Zakres dat" }) as HTMLFormElement;
  expect(form.method).toBe("get");
  expect((screen.getByLabelText("Od") as HTMLInputElement).value).toBe("2026-09-01");
  expect((screen.getByLabelText("Do") as HTMLInputElement).value).toBe("2026-10-24");
  expect(screen.getByRole("link", { name: "Ten miesiąc" }).getAttribute("href")).toBe("/statistics?from=2026-10-01&to=2026-10-24");
  expect(screen.getByRole("alert").textContent).toContain("Pokazano bieżący miesiąc");
});
