// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it } from "vitest";
import { MobileOrderDetails } from "./MobileOrderDetails";
import { order } from "./demo";

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

it("shows the header, 4-stage progress and the quote from the same data as D-04 (M-04)", () => {
  render(<MobileOrderDetails data={order} />);
  expect(screen.getByRole("heading", { level: 1, name: "Porsche Panamera" })).toBeTruthy();
  expect(screen.getByText("#DF-0248")).toBeTruthy();
  expect(screen.getByText("WA 911PC · Boks 01")).toBeTruthy();
  expect(screen.getByText("12 zdjęć")).toBeTruthy();

  const progress = screen.getByRole("region", { name: "Postęp prac" });
  expect(within(progress).getByText("2 z 4")).toBeTruthy();
  const steps = within(progress).getAllByRole("listitem");
  expect(steps).toHaveLength(4);
  expect(steps[1]!.getAttribute("aria-current")).toBe("step");
  expect(steps[1]!.textContent).toContain("Korekta lakieru");

  const quote = screen.getByRole("region", { name: "Wycena" });
  expect(quote.textContent).toContain("✓ Zaakceptowana");
  expect(quote.textContent).toContain("2 400 zł");
  expect(quote.textContent).toContain("Razem brutto4 800 zł");
});

it("offers a real phone link and a back link", () => {
  render(<MobileOrderDetails data={order} />);
  expect(screen.getByRole("link", { name: /Zadzwoń do klienta: Adam Nowak/ }).getAttribute("href")).toBe("tel:+48600123456");
  expect(screen.getByRole("link", { name: "Wróć do zleceń" }).getAttribute("href")).toBe("/orders");
});

it("keeps the stage change as a 'coming soon' sheet and saves nothing", async () => {
  const user = userEvent.setup();
  render(<MobileOrderDetails data={order} />);
  await user.click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  const sheet = screen.getByRole("dialog", { name: "Zmiana etapu — wkrótce" });
  expect(within(sheet).getByText(/nie są jeszcze zapisywane/)).toBeTruthy();
  await user.click(within(sheet).getByRole("button", { name: "Zamknij" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
