// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { DayGrid } from "./DayGrid";
import { bookings, layoutBookings } from "./demo";

afterEach(cleanup);
it("separates simultaneous reservations and reuses lanes after an interval ends", () => {
  const events = [
    { ...bookings[0]!, id: "a", start: 480, end: 600 },
    { ...bookings[0]!, id: "b", start: 540, end: 660 },
    { ...bookings[0]!, id: "c", start: 600, end: 720 },
    { ...bookings[0]!, id: "d", start: 720, end: 780 },
  ];
  const layout = layoutBookings(events);
  expect(layout.map(({ lane, lanes }) => [lane, lanes])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
});
it("filters employees, navigates dates and opens the day from the week", async () => {
  const user = userEvent.setup();
  render(<DayGrid />);
  expect(screen.getByRole("link", { name: /Porsche Panamera/ }).getAttribute("href")).toBe("/orders/DF-0248");
  expect(screen.getByLabelText("Teraz 11:30")).toBeTruthy();
  await user.selectOptions(screen.getByRole("combobox"), "Kamil");
  expect(screen.queryByText("Porsche Panamera")).toBeNull();
  expect(screen.getByText("Audi Q5")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Następny okres" }));
  expect(screen.getByText("Brak rezerwacji na ten dzień.")).toBeTruthy();
  expect(screen.queryByLabelText("Teraz 11:30")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Dzisiaj" }));
  await user.click(screen.getByRole("button", { name: "Tydzień" }));
  await user.click(screen.getByRole("button", { name: "24 października 2026" }));
  expect(screen.getByRole("button", { name: "Dzień" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("Audi Q5")).toBeTruthy();
});
