// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { MobileDashboard } from "./mobile-dashboard";
import type { DashboardMetrics } from "@/src/server/pulpit/metrics";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

const order = (over: Partial<DashboardMetrics["todayOrders"][number]>) => ({
  number: "DF-0000",
  vehicle: "Auto",
  customer: "Klient",
  plate: "WA 1",
  service: "Usługa",
  grossPln: "100.00",
  bay: null,
  scheduledFrom: "2026-10-24T06:00:00.000Z",
  scheduledTo: "2026-10-24T10:00:00.000Z",
  dueAt: null,
  status: "in-progress" as const,
  ...over,
});

const featured = {
  number: "DF-0248",
  vehicle: "Porsche Panamera",
  customer: "Adam Nowak",
  plate: "WA 911PC",
  service: "Korekta + ceramika",
  bay: "Boks 01",
  stage: 2,
  dueAt: null,
  grossPln: "4800.00",
  status: "in-progress" as const,
};

const data = {
  dateLabel: "sobota, 24 października 2026",
  active: { total: 7, inProgress: 3, ready: 2, accepted: 2 },
  occupancy: { percent: 82, occupiedHours: 13, capacityHours: 16 },
  alerts: { coatingClients: 3, rejected: [] },
  featured,
  todayOrders: [
    order({ number: "DF-0248", vehicle: "Porsche Panamera", bay: "Boks 01" }),
    order({ number: "DF-0249", vehicle: "Audi Q5", service: "Pakiet premium", bay: "Boks 02", scheduledTo: "2026-10-24T10:00:00.000Z" }),
    order({ number: "DF-0245", vehicle: "BMW Seria 3", service: "Detailing wnętrza", status: "ready-for-pickup", dueAt: "2026-10-24T10:30:00.000Z" }),
    order({ number: "DF-0250", vehicle: "BMW M4", service: "Detailing wnętrza", bay: "Boks 01", status: "scheduled", scheduledFrom: "2026-10-24T11:00:00.000Z" }),
  ],
} as unknown as DashboardMetrics;

it("shows the KPIs, date and greeting from the mockup", () => {
  render(<MobileDashboard data={data} name="Michał Kowalski" />);
  expect(screen.getByText("sobota, 24 października")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dzień dobry, Michał");
  const kpis = within(screen.getByRole("region", { name: "Wskaźniki dnia" }));
  expect(kpis.getByText("3").nextSibling?.textContent).toBe("w trakcie");
  expect(kpis.getByText("2").nextSibling?.textContent).toBe("do odbioru");
  expect(kpis.getByText("82%").nextSibling?.textContent).toBe("obłożenie");
});

it("renders the workshop card with the current stage, finish and camera actions", async () => {
  const user = userEvent.setup();
  render(<MobileDashboard data={data} name="Michał Kowalski" />);
  expect(screen.getByText("Na warsztacie · Boks 01")).toBeTruthy();
  expect(screen.getByText("Etap 2 z 4 · Korekta lakieru")).toBeTruthy();
  expect(screen.getByText("Dalej: Aplikacja ceramiki")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
  expect(screen.getByRole("button", { name: "Zdjęcie" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  expect(screen.getByRole("dialog", { name: "Zakończ: Korekta lakieru" }).textContent).toContain("wkrótce");
});

it("lists the rest of the day without repeating the featured car, in Warsaw time", () => {
  render(<MobileDashboard data={data} name="Michał Kowalski" />);
  const list = within(screen.getByRole("list"));
  expect(list.queryByText("Porsche Panamera")).toBeNull();
  expect(list.getByText("Pakiet premium · Boks 02")).toBeTruthy();
  expect(list.getByText("do 12:00")).toBeTruthy();
  expect(list.getByText("Detailing wnętrza · gotowe")).toBeTruthy();
  expect(list.getByText("12:30")).toBeTruthy();
  expect(list.getByText("13:00")).toBeTruthy();
});

it("handles a day without a car in progress", () => {
  render(<MobileDashboard data={{ ...data, featured: null, todayOrders: [] }} name="Michał Kowalski" />);
  expect(screen.getByText("Brak aut w trakcie pracy w boksach na dziś.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Zakończ/ })).toBeNull();
  expect(screen.getByText("Na dziś nie ma więcej zaplanowanych zleceń.")).toBeTruthy();
});
