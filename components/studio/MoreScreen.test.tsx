// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { MoreScreen } from "./MoreScreen";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);
const props = {
  studio: "Obsidian Studio",
  studioId: "a",
  choices: [{ studioId: "a", studio: { name: "Obsidian Studio" } }],
  name: "Michał Kowalski",
  location: "Warszawa, Mokotów",
  attentionCount: 2,
};
it("links existing modules, displays attention and keeps future modules inside a notice", async () => {
  const user = userEvent.setup();
  render(<MoreScreen {...props} role="manager" />);
  expect(
    screen
      .getByRole("link", { name: /Faktury 2 wymagają uwagi/ })
      .getAttribute("href"),
  ).toBe("/invoices");
  expect(
    screen.getByRole("link", { name: "Klienci i auta" }).getAttribute("href"),
  ).toBe("/customers");
  await user.click(screen.getByRole("button", { name: "Magazyn Wkrótce" }));
  expect(
    screen.getByRole("dialog", { name: "Magazyn · Wkrótce" }),
  ).toBeTruthy();
});
it("hides finance and team links from workers", () => {
  render(<MoreScreen {...props} role="worker" />);
  expect(screen.queryByRole("link", { name: /Faktury/ })).toBeNull();
  expect(screen.queryByRole("link", { name: "Zaproś do studia" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: /Ustawienia i KSeF/ }),
  ).toBeNull();
  expect(
    screen.getByRole("link", { name: "Wyloguj" }).getAttribute("href"),
  ).toBe("/logout");
  expect(screen.queryByRole("link", { name: "Ustawienia i KSeF" })).toBeNull();
});
it("opens studio settings for the owner", () => {
  render(<MoreScreen {...props} role="owner" />);
  expect(screen.getByRole("link", { name: "Ustawienia i KSeF" }).getAttribute("href")).toBe("/settings");
  expect(screen.queryByRole("button", { name: /Ustawienia i KSeF/ })).toBeNull();
});
it("keeps studio settings off the manager menu", () => {
  render(<MoreScreen {...props} role="manager" />);
  expect(screen.queryByRole("link", { name: "Ustawienia i KSeF" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Ustawienia i KSeF/ })).toBeNull();
  expect(screen.getByRole("link", { name: "Zaproś do studia" }).getAttribute("href")).toBe("/team");
});
