// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { OrderDetails } from "./OrderDetails";
import { parseTab } from "./tabs";
import { order } from "./demo";
import { pluralPhotos } from "./panels";

beforeAll(() => {
  // jsdom has no modal dialog support.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

it("shows the Figma overview with four studio stages, quote and contact", () => {
  render(<OrderDetails data={order} />);
  expect(screen.getByRole("heading", { level: 1, name: "Porsche Panamera" })).toBeTruthy();
  expect(screen.getByText("Zlecenie #DF-0248 / Adam Nowak / WA 911PC")).toBeTruthy();
  const stages = within(screen.getByRole("list", { name: "Etapy zlecenia" })).getAllByRole("listitem");
  expect(stages).toHaveLength(4);
  expect(stages[1]!.getAttribute("aria-current")).toBe("step");
  expect(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" })).toBeTruthy();
  const quote = screen.getByRole("region", { name: "Wycena" });
  expect(within(quote).getAllByText("2 400 zł")).toHaveLength(2);
  expect(within(quote).getByText("4 800 zł")).toBeTruthy();
  expect(screen.getByRole("link", { name: "+48 600 123 456" }).getAttribute("href")).toBe("tel:+48600123456");
  expect(screen.getByText(/Stan zaakceptowany przez klienta · 24\.10\.2026, 08:04/)).toBeTruthy();
});

it("switches tabs with mouse and keyboard and keeps the choice in the URL", async () => {
  const user = userEvent.setup();
  render(<OrderDetails data={order} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((tab) => tab.textContent)).toEqual(["Przegląd", "Zdjęcia12", "Stan auta3", "Historia"]);
  tabs[0]!.focus();
  await user.keyboard("{ArrowRight}");
  expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
  expect(document.activeElement).toBe(tabs[1]);
  expect(window.location.search).toBe("?tab=zdjecia");
  expect(within(screen.getByRole("tabpanel")).getAllByRole("listitem")).toHaveLength(12);
  await user.keyboard("{End}");
  expect(screen.getByRole("heading", { name: "Historia zlecenia" })).toBeTruthy();
  const events = within(screen.getByRole("tabpanel")).getAllByRole("listitem");
  expect(events[0]!.textContent).toContain("Dodano zdjęcie #12");
  await user.click(tabs[2]!);
  expect(screen.getByRole("table", { name: /Uszkodzenia zapisane w protokole #P-0248/ })).toBeTruthy();
  await user.click(tabs[0]!);
  expect(window.location.search).toBe("");
});

it("starts on the tab from the URL and falls back to the overview", () => {
  expect(parseTab("historia")).toBe("historia");
  expect(parseTab("nieznana")).toBe("przeglad");
  expect(parseTab(undefined)).toBe("przeglad");
  render(<OrderDetails data={order} initialTab="stan-auta" />);
  expect(screen.getByRole("tab", { name: /Stan auta/ }).getAttribute("aria-selected")).toBe("true");
});

it("states plainly that mutations are not available yet", async () => {
  const user = userEvent.setup();
  render(<OrderDetails data={order} />);
  await user.click(screen.getByRole("button", { name: "Link dla klienta ↗" }));
  expect(screen.getByRole("dialog", { name: "Link dla klienta — wkrótce" }).hasAttribute("open")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  expect(screen.getByText(/nie są jeszcze zapisywane/)).toBeTruthy();
});

it("handles an order without photos and pluralises the photo count", () => {
  render(<OrderDetails data={{ ...order, photos: [] }} />);
  expect(screen.getByText(/Brak zdjęć/)).toBeTruthy();
  expect([1, 2, 5, 12, 14, 22].map(pluralPhotos)).toEqual(["1 zdjęcie", "2 zdjęcia", "5 zdjęć", "12 zdjęć", "14 zdjęć", "22 zdjęcia"]);
});
