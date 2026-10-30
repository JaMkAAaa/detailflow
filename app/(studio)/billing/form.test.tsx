// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutForm } from "./form";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows full annual prices and sends the chosen period to the tenant endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Sandbox test" }) });
  vi.stubGlobal("fetch", fetch);
  const user = userEvent.setup();
  render(<CheckoutForm studioId="studio_test" />);
  await user.click(screen.getByLabelText("Plan (netto PLN)"));
  expect(screen.getByRole("option", { name: /Solo — 79.00 zł \/ mies./ })).toBeTruthy();
  await user.keyboard("{Escape}");
  await user.click(screen.getByLabelText("Okres rozliczeń"));
  await user.click(screen.getByRole("option", { name: /Rocznie/ }));
  await user.click(screen.getByLabelText("Plan (netto PLN)"));
  expect(screen.getByRole("option", { name: /Studio — 1490.00 zł \/ rok/ })).toBeTruthy();
  await user.click(screen.getByRole("option", { name: /Studio — 1490.00 zł \/ rok/ }));
  await user.click(screen.getByRole("button", { name: "Przejdź do Stripe Checkout" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/studios/studio_test/billing/checkout", expect.objectContaining({ body: JSON.stringify({ plan: "studio", interval: "yearly" }) })));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Sandbox test");
});
