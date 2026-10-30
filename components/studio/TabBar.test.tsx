// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
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
  render(<TabBar />);
  const nav = screen.getByRole("navigation", { name: "Nawigacja mobilna" });
  const items = [...nav.querySelectorAll("a, button")];
  expect(items.map((item) => item.textContent || item.getAttribute("aria-label"))).toEqual([
    "Pulpit",
    "Kalendarz",
    "Nowe zlecenie",
    "Zlecenia",
    "Więcej",
  ]);
  expect(within(nav).getByRole("link", { name: "Zlecenia" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Pulpit" }).getAttribute("aria-current")).toBeNull();
});

it.each(["/invoices", "/settings"])("highlights Więcej for %s", (route) => {
  pathname.current = route;
  render(<TabBar />);
  expect(screen.getByRole("link", { name: "Więcej" }).getAttribute("aria-current")).toBe("page");
});

it("opens the full More screen", () => {
  pathname.current = "/more";
  render(<TabBar />);
  const link = screen.getByRole("link", { name: "Więcej" });
  expect(link.getAttribute("href")).toBe("/more");
  expect(link.getAttribute("aria-current")).toBe("page");
});

it("opens the mobile create-order page from +", () => {
  render(<TabBar />);
  expect(screen.getByRole("link", { name: "Nowe zlecenie" }).getAttribute("href")).toBe("/orders/new");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("gives way to the order action bar on order details (M-04) but not on the list", () => {
  pathname.current = "/orders/DF-0248";
  const { unmount } = render(<TabBar />);
  expect(screen.getByRole("navigation", { name: "Nawigacja mobilna" }).className).toContain("max-lg:hidden");
  unmount();
  pathname.current = "/orders";
  render(<TabBar />);
  expect(screen.getByRole("navigation", { name: "Nawigacja mobilna" }).className).not.toContain("max-lg:hidden");
});

it.each(["/orders/new", "/quotes/new", "/invoices/FV%2F41?env=test"])("gives way to mobile actions on %s", (route) => {
  pathname.current = route;
  render(<TabBar />);
  expect(screen.getByRole("navigation").className).toContain("max-lg:hidden");
});
