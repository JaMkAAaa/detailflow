// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { OrdersToday } from "./orders-today";
import { Schedule } from "./schedule";
import { todayOrders } from "./demo";

afterEach(cleanup);

it("filters today's orders without confusing the six rows with seven active orders", async () => {
  const user = userEvent.setup();
  const openOrder = vi.fn();
  render(<OrdersToday orders={todayOrders} onOpenOrder={openOrder} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(7);
  const inProgress = screen.getByRole("button", { name: "W trakcie 3" });
  inProgress.focus();
  await user.keyboard("{Enter}");
  expect(inProgress.getAttribute("aria-pressed")).toBe("true");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  await user.click(screen.getByRole("button", { name: /Porsche Panamera/ }));
  expect(openOrder).toHaveBeenCalledWith(todayOrders[0]);
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
      onOpenOrder={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "W trakcie 0" }));
  expect(screen.getByRole("heading", { name: "Brak wyników" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(screen.getByText("BMW M4")).toBeTruthy();
  rerender(<OrdersToday orders={[]} onOpenOrder={vi.fn()} />);
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
