// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { MobileDashboard } from "./mobile-dashboard";
import type { DashboardMetrics } from "@/src/server/pulpit/metrics";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

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
  id: "order-a",
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
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał Kowalski" />);
  expect(screen.getByText("sobota, 24 października")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Dzień dobry, Michał");
  const kpis = within(screen.getByRole("region", { name: "Wskaźniki dnia" }));
  expect(kpis.getByText("3").nextSibling?.textContent).toBe("w trakcie");
  expect(kpis.getByText("2").nextSibling?.textContent).toBe("do odbioru");
  expect(kpis.getByText("82%").nextSibling?.textContent).toBe("obłożenie");
});

it("renders the workshop card with the current stage, finish and camera actions", async () => {
  const user = userEvent.setup();
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał Kowalski" />);
  expect(screen.getByText("Na warsztacie · Boks 01")).toBeTruthy();
  expect(screen.getByText("Etap 2 z 4 · Korekta lakieru")).toBeTruthy();
  expect(screen.getByText("Dalej: Aplikacja ceramiki")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("2");
  expect(screen.getByLabelText("Zdjęcie").getAttribute("type")).toBe("file");
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetcher);
  await user.click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-a/orders/order-a/advance", { method: "POST" });
  expect(refresh).toHaveBeenCalledOnce();
});

it("lists the rest of the day without repeating the featured car, in Warsaw time", () => {
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał Kowalski" />);
  const list = within(screen.getByRole("list"));
  expect(list.queryByText("Porsche Panamera")).toBeNull();
  expect(list.getByText("Pakiet premium · Boks 02")).toBeTruthy();
  expect(list.getByText("do 12:00")).toBeTruthy();
  expect(list.getByText("Detailing wnętrza · gotowe")).toBeTruthy();
  expect(list.getByText("12:30")).toBeTruthy();
  expect(list.getByText("13:00")).toBeTruthy();
});

it("handles a day without a car in progress", () => {
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={{ ...data, featured: null, todayOrders: [] }} name="Michał Kowalski" />);
  expect(screen.getByText("Brak aut w trakcie pracy w boksach na dziś.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Zakończ/ })).toBeNull();
  expect(screen.getByText("Na dziś nie ma więcej zaplanowanych zleceń.")).toBeTruthy();
});

it("shows the same dashboard alerts under the bell and links day rows to orders", async () => {
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał" />);
  expect(screen.getByRole("link", { name: "Audi Q5" }).getAttribute("href")).toBe("/orders/DF-0249");
  await userEvent.setup().click(screen.getByRole("button", { name: "Powiadomienia" }));
  expect(within(screen.getByRole("dialog", { name: "Powiadomienia" })).getByRole("link", { name: /Serwis ceramiki/ }).getAttribute("href")).toBe("/customers");
});

it("uploads a workshop photo through the same presigned flow and shows a confirm error", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/studios/studio-a/orders/order-a/photos" && init?.method === "POST") {
      return { ok: false, status: 400, json: async () => ({ error: "Zdjęcie może mieć maksymalnie 20 MB." }) };
    }
    return { ok: true, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetcher);
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał Kowalski" />);
  const file = new File([new Uint8Array(4)], "hala.jpg", { type: "image/jpeg" });
  await user.upload(screen.getByLabelText("Zdjęcie"), file);
  expect(await screen.findByText("Zdjęcie może mieć maksymalnie 20 MB.")).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-a/orders/order-a/photos", expect.objectContaining({ method: "POST" }));
  expect(refresh).not.toHaveBeenCalled();
});

it("keeps the order context on a failed stage advance", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Zlecenie zmieniono w innej sesji." }) }));
  render(<MobileDashboard studioId="studio-a" canInvoice={false} data={data} name="Michał" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  expect(await screen.findByText("Zlecenie zmieniono w innej sesji.")).toBeTruthy();
  expect(refresh).not.toHaveBeenCalled();
});
