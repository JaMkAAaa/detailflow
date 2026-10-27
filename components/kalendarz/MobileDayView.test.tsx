// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { MobileDayView } from "./MobileDayView";
import { bookings, formatDuration, freeWindows } from "./demo";

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

it("lists the demo day in time order with the now line and the free window (M-02)", () => {
  render(<MobileDayView />);
  const plan = screen.getByRole("region", { name: /Plan boksów/ });
  const text = plan.textContent!;
  const order = ["Porsche Panamera", "Audi Q5", "11:30", "Wolne 1,5 h · Boks 02", "BMW M4", "Mercedes C"].map((part) => text.indexOf(part));
  expect(order.every((index) => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(within(plan).getByRole("separator", { name: "Teraz 11:30" })).toBeTruthy();
  expect(within(plan).getByRole("link", { name: /Porsche Panamera/ }).getAttribute("href")).toBe("/orders/DF-0248");
  expect(within(plan).getAllByText("● W trakcie")).toHaveLength(2);
  expect(within(plan).getAllByText("○ Zaplanowane")).toHaveLength(2);
});

it("highlights the selected day in the week strip and marks days with bookings", () => {
  render(<MobileDayView />);
  const week = screen.getByRole("region", { name: "Tydzień" });
  const days = within(week).getAllByRole("button");
  expect(days.map((day) => day.textContent!.slice(0, 2))).toEqual(["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"]);
  expect(within(week).getByRole("button", { name: "sobota, 24 października" }).getAttribute("aria-pressed")).toBe("true");
});

it("filters by bay and navigates weeks, then returns to today", async () => {
  const user = userEvent.setup();
  render(<MobileDayView />);
  await user.click(screen.getByRole("button", { name: "Boks 02" }));
  expect(screen.queryByText("Porsche Panamera")).toBeNull();
  expect(screen.getByText("Audi Q5")).toBeTruthy();
  expect(screen.getByText(/Wolne 1,5 h · Boks 02/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Boks 01" }));
  expect(screen.queryByText(/Wolne/)).toBeNull();

  await user.click(screen.getByRole("button", { name: "Następny tydzień" }));
  expect(screen.getByText("Brak rezerwacji na ten dzień.")).toBeTruthy();
  expect(screen.queryByRole("separator")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Wróć do dziś" }));
  expect(screen.getByText("Porsche Panamera")).toBeTruthy();
});

it("opens the reservation sheet from the free window", async () => {
  const user = userEvent.setup();
  render(<MobileDayView reservationForm={<p>Formularz rezerwacji</p>} />);
  await user.click(screen.getByRole("button", { name: /Wolne 1,5 h/ }));
  expect(within(screen.getByRole("dialog", { name: /Nowa rezerwacja|Rezerwacja/ })).getByText("Formularz rezerwacji")).toBeTruthy();
});

it("computes free windows only between bookings and skips the ones already over", () => {
  expect(freeWindows(bookings, 2)).toEqual([{ start: 720, end: 810 }]);
  expect(freeWindows(bookings, 2, 900)).toEqual([]);
  expect(freeWindows(bookings, 1)).toEqual([]);
  expect(formatDuration(90)).toBe("1,5 h");
  expect(formatDuration(120)).toBe("2 h");
});
