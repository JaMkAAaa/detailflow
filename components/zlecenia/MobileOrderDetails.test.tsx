// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
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
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the header, 4-stage progress and the quote from the same data as D-04 (M-04)", () => {
  render(<MobileOrderDetails data={order} studioId="studio-test" />);
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
  render(<MobileOrderDetails data={order} studioId="studio-test" />);
  expect(screen.getByRole("link", { name: /Zadzwoń do klienta: Adam Nowak/ }).getAttribute("href")).toBe("tel:+48600123456");
  expect(screen.getByRole("link", { name: "Wróć do zleceń" }).getAttribute("href")).toBe("/orders");
});

it("posts stage advancement and shows a server error without losing the order context", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: "Konflikt zapisu etapu." }), { status: 409, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<MobileOrderDetails data={order} studioId="studio-test" />);
  await user.click(screen.getByRole("button", { name: "Zakończ: Korekta lakieru" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Konflikt zapisu etapu.");
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-test/orders/demo-order/advance", { method: "POST" });
  expect(screen.getByRole("heading", { name: "Porsche Panamera" })).toBeTruthy();
});
