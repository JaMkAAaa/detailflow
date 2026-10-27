// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { MobileOrders } from "./MobileOrders";

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

it("renders all 7 active orders in the scrolling content, grouped as in Figma (M-03)", () => {
  render(<MobileOrders />);
  expect(screen.getByText("7 aktywnych")).toBeTruthy();
  const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
  expect(headings).toEqual(["W trakcie · 3", "Do odbioru · 2", "Przyjęte · 2"]);
  // Żadnego obcięcia do „folda”: każde aktywne zlecenie jest w DOM, zakończone #DF-0244 nie.
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.queryByText(/DF-0244/)).toBeNull();
  expect(screen.getByRole("button", { name: "Wszystkie 7" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Przyjęte 2" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "W trakcie 3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Do odbioru 2" })).toBeTruthy();
});

it("shows number, customer, due label and PLN amount, and links the Porsche to M-04", () => {
  render(<MobileOrders />);
  const porsche = screen.getByRole("link", { name: /Porsche Panamera/ });
  expect(porsche.getAttribute("href")).toBe("/orders/DF-0248");
  expect(porsche.textContent).toContain("#DF-0248 · Adam Nowak");
  expect(porsche.textContent).toContain("Korekta + ceramika");
  expect(porsche.textContent).toContain("Odbiór: jutro 16:00");
  expect(porsche.textContent).toContain("4 800 zł");
});

it("filters by status chip and by search incl. plate, and clears", async () => {
  const user = userEvent.setup();
  render(<MobileOrders />);
  await user.click(screen.getByRole("button", { name: "Do odbioru 2" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByText("Porsche Panamera")).toBeNull();

  await user.click(screen.getByRole("button", { name: "Wszystkie 7" }));
  await user.type(screen.getByRole("searchbox"), "WE 482");
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.getByText("Audi Q5")).toBeTruthy();
  expect(screen.getByRole("button", { name: "W trakcie 1" })).toBeTruthy();

  await user.clear(screen.getByRole("searchbox"));
  await user.type(screen.getByRole("searchbox"), "nic takiego");
  expect(screen.getByText("Nie znaleziono „nic takiego”")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
});

it("opens a 'coming soon' sheet for orders without a detail screen", async () => {
  const user = userEvent.setup();
  render(<MobileOrders />);
  await user.click(screen.getByRole("button", { name: /Audi Q5/ }));
  const sheet = screen.getByRole("dialog");
  expect(within(sheet).getByText(/Szczegóły zlecenia będą dostępne wkrótce/)).toBeTruthy();
});
