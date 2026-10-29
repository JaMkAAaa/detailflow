// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { OrdersToday } from "./orders-today";
import { Schedule } from "./schedule";
import { todayOrders } from "./demo";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("filters today's orders without confusing the six rows with seven active orders", async () => {
  const user = userEvent.setup();
  render(<OrdersToday orders={todayOrders} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(7);
  const inProgress = screen.getByRole("button", { name: "W trakcie 3" });
  inProgress.focus();
  await user.keyboard("{Enter}");
  expect(inProgress.getAttribute("aria-pressed")).toBe("true");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  expect(screen.getByRole("link", { name: /Porsche Panamera/ }).getAttribute("href")).toBe("/orders/DF-0248");
  await user.click(screen.getByRole("button", { name: "Do odbioru 2" }));
  expect(screen.queryByText("Porsche Panamera")).toBeNull();
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  await user.click(screen.getByRole("button", { name: "Wszystkie 6" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(7);
});

it("offers a way back when a filter has no matches and handles an empty day", async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <OrdersToday
      orders={todayOrders.filter((order) => order.status === "scheduled")}
    />,
  );
  await user.click(screen.getByRole("button", { name: "W trakcie 0" }));
  expect(screen.getByRole("heading", { name: "Brak wyników" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(screen.getByText("BMW M4")).toBeTruthy();
  rerender(<OrdersToday orders={[]} />);
  expect(
    screen.getByRole("heading", { name: "Na dziś wszystko gotowe" }),
  ).toBeTruthy();
});

it("navigates the plan and restores the demo day and current-time marker", async () => {
  const user = userEvent.setup();
  render(<Schedule />);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
    "Teraz 11:30",
  );
  await user.click(screen.getByRole("button", { name: "Następny dzień" }));
  expect(screen.getByText("25 października")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Brak rezerwacji" })).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Wróć do dzisiaj" }));
  expect(screen.getByText("24 października")).toBeTruthy();
  expect(screen.getByRole("img")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Poprzedni dzień" }));
  expect(screen.getByText("23 października")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Dzisiaj" }));
  expect(screen.getByRole("img")).toBeTruthy();
});

it("renders database metrics and empty states without demo alerts or cars", async () => {
  const { Dashboard } = await import("./dashboard");
  const data = {
    dateLabel: "poniedziałek, 26 października 2026",
    monthLabel: "październik",
    revenuePln: "1234.56",
    active: { total: 0, inProgress: 0, ready: 0, accepted: 0 },
    occupancy: { percent: 0, occupiedHours: 0, capacityHours: 0 },
    returning: { percent: 0, regular: 0, total: 0 },
    todayOrders: [],
    plan: { bays: [], bookings: [] },
    featured: null,
    alerts: { coatingClients: 0, rejected: [] },
  };
  const { rerender } = render(<Dashboard studioId="studio-a" canInvoice={false} data={data} name="Anna Testowa" />);
  expect(screen.getByText("Dzień dobry, Anna.")).toBeTruthy();
  expect(screen.getByText("1 234,56 zł")).toBeTruthy();
  expect(screen.getByText("Brak alertów wymagających uwagi.")).toBeTruthy();
  expect(
    screen.getByText("Brak aut w trakcie pracy w boksach na dziś."),
  ).toBeTruthy();
  expect(screen.queryByText(/CarPro|Porsche|Faktura odrzucona/)).toBeNull();
  expect(screen.getByRole("link", { name: "+ Nowe zlecenie" }).getAttribute("href")).toBe("/orders?new=1");
  expect(screen.queryByRole("link", { name: "Wystaw fakturę" })).toBeNull();
  await userEvent.setup().click(screen.getByRole("button", { name: "Wystaw fakturę" }));
  expect(screen.getByText("Faktury wystawia właściciel lub manager po zakończeniu zlecenia.")).toBeTruthy();
  rerender(<Dashboard studioId="studio-a" canInvoice data={data} name="Anna Testowa" />);
  expect(screen.getByRole("link", { name: "Wystaw fakturę" }).getAttribute("href")).toBe("/invoices/new");
});
