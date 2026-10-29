// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutForm } from "./form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows full annual prices and sends the chosen period to the tenant endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Sandbox test" }) });
  vi.stubGlobal("fetch", fetch);
  render(<CheckoutForm studioId="studio_test" />);
  expect(screen.getByRole("option", { name: /Solo — 79.00 zł \/ mies./ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Okres rozliczeń"), { target: { value: "yearly" } });
  expect(screen.getByRole("option", { name: /Studio — 1490.00 zł \/ rok/ })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Plan (netto PLN)"), { target: { value: "studio" } });
  fireEvent.click(screen.getByRole("button", { name: "Przejdź do Stripe Checkout" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/studios/studio_test/billing/checkout", expect.objectContaining({ body: JSON.stringify({ plan: "studio", interval: "yearly" }) })));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Sandbox test");
});
