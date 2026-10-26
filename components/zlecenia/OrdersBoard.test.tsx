// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { OrdersBoard } from "./OrdersBoard";
import { boardOrders, columns, filterOrders, ordersLabel } from "./demo";

afterEach(cleanup);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
});

const counts = () => Object.fromEntries(columns.map(({ title }) => [title, screen.getByRole("region", { name: new RegExp(`${title}`) })]));
const cardsIn = (title: string) => within(counts()[title]!).getAllByRole("button").filter((button) => button.textContent?.includes("#DF-"));
const chip = (title: string) => within(counts()[title]!).getByLabelText(/Liczba zleceń/).textContent;

it("renders the four Figma columns with counters equal to the number of cards", () => {
  render(<OrdersBoard />);
  expect(screen.getByText(/8 zleceń w widoku/)).toBeTruthy();
  for (const [title, expected] of [["Przyjęte", 2], ["W trakcie", 3], ["Do odbioru", 2], ["Zakończone", 1]] as const) {
    expect(cardsIn(title)).toHaveLength(expected);
    expect(chip(title)).toBe(String(expected));
  }
  expect(screen.getByAltText("Zdjęcie: Porsche Panamera").getAttribute("src")).toBe("/zlecenia/porsche.png");
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(screen.getByText("4 800 zł")).toBeTruthy();
});

it("filters by search, employee and service and keeps counters in sync", async () => {
  const user = userEvent.setup();
  render(<OrdersBoard />);
  await user.type(screen.getByRole("searchbox"), "adam");
  expect(cardsIn("W trakcie")).toHaveLength(1);
  expect(chip("W trakcie")).toBe("1");
  expect(chip("Przyjęte")).toBe("0");
  expect(screen.getByText(/1 zlecenie w widoku/)).toBeTruthy();
  await user.clear(screen.getByRole("searchbox"));
  await user.selectOptions(screen.getByLabelText("Filtruj pracownika"), "Michał");
  expect(["Przyjęte", "W trakcie", "Do odbioru", "Zakończone"].map(chip)).toEqual(["0", "1", "1", "1"]);
  await user.selectOptions(screen.getByLabelText("Filtruj usługę"), "Serwis powłoki");
  expect(screen.getByText(/1 zlecenie w widoku/)).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Filtruj usługę"), "Mycie + wosk");
  expect(screen.getByRole("heading", { name: "Brak wyników" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(screen.getByText(/8 zleceń w widoku/)).toBeTruthy();
});

it("switches to the list view with the same filtered orders", async () => {
  const user = userEvent.setup();
  render(<OrdersBoard />);
  await user.click(screen.getByRole("button", { name: "Lista" }));
  expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(9);
  await user.selectOptions(screen.getByLabelText("Filtruj pracownika"), "Kamil");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: "Tablica" }));
  expect(screen.getAllByRole("region").length).toBe(4);
});

it("opens an order notice on click and does not 404", async () => {
  const user = userEvent.setup();
  render(<OrdersBoard />);
  await user.click(cardsIn("W trakcie")[0]!);
  expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  expect(screen.getByText("Porsche Panamera · #DF-0248", { exact: false })).toBeTruthy();
});

it("matches Polish plurals and matches case-insensitively", () => {
  expect([1, 2, 5, 12, 22].map(ordersLabel)).toEqual(["1 zlecenie", "2 zlecenia", "5 zleceń", "12 zleceń", "22 zlecenia"]);
  expect(filterOrders(boardOrders, { query: "df-0248", employee: "", service: "" })).toHaveLength(1);
  expect(filterOrders(boardOrders, { query: "DOWSKI", employee: "", service: "" })).toHaveLength(1);
});
