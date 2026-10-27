// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

// jsdom nie implementuje <dialog>.showModal().
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(() => {
  cleanup();
  pathname.current = "/";
});

it("shows the five tabs in order and marks the current route", () => {
  pathname.current = "/orders/DF-0248";
  render(<TabBar role="owner" />);
  const nav = screen.getByRole("navigation", { name: "Nawigacja mobilna" });
  const items = [...nav.querySelectorAll("a, button")];
  expect(items.map((item) => item.textContent || item.getAttribute("aria-label"))).toEqual([
    "Pulpit",
    "Kalendarz",
    "Nowe zlecenie lub wycena",
    "Zlecenia",
    "Więcej",
  ]);
  expect(within(nav).getByRole("link", { name: "Zlecenia" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Pulpit" }).getAttribute("aria-current")).toBeNull();
});

it("highlights Więcej for routes that live under it", () => {
  pathname.current = "/invoices";
  render(<TabBar role="owner" />);
  expect(screen.getByRole("button", { name: "Więcej" }).getAttribute("aria-current")).toBe("page");
});

it("opens a sheet with new order and quote from the + button", async () => {
  const user = userEvent.setup();
  render(<TabBar role="owner" />);
  await user.click(screen.getByRole("button", { name: "Nowe zlecenie lub wycena" }));
  const sheet = screen.getByRole("dialog", { name: "Nowe" });
  expect(within(sheet).getByRole("button", { name: /Nowe zlecenie/ })).toBeTruthy();
  expect(within(sheet).getByRole("link", { name: /Nowa wycena/ }).getAttribute("href")).toBe("/quotes/new");
});

it("hides owner-only links from workers in Więcej", async () => {
  const user = userEvent.setup();
  render(<TabBar role="worker" />);
  await user.click(screen.getByRole("button", { name: "Więcej" }));
  const sheet = screen.getByRole("dialog", { name: "Więcej" });
  expect(within(sheet).getByRole("link", { name: "Klienci i auta" })).toBeTruthy();
  expect(within(sheet).queryByRole("link", { name: "Faktury" })).toBeNull();
  expect(within(sheet).queryByRole("link", { name: "Zaproś do studia" })).toBeNull();
});

it("gives way to the order action bar on order details (M-04) but not on the list", () => {
  pathname.current = "/orders/DF-0248";
  const { unmount } = render(<TabBar role="owner" />);
  expect(screen.getByRole("navigation", { name: "Nawigacja mobilna" }).className).toContain("max-lg:hidden");
  unmount();
  pathname.current = "/orders";
  render(<TabBar role="owner" />);
  expect(screen.getByRole("navigation", { name: "Nawigacja mobilna" }).className).not.toContain("max-lg:hidden");
});
