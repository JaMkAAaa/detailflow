/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ClientPrivacyActions } from "./privacy-actions";
const { refresh, push } = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("does not erase data after the user cancels confirmation", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(false);
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<ClientPrivacyActions studioId="a" clientId="c" />);
  await userEvent.click(screen.getByRole("button", { name: "Usuń dane osobowe" }));
  expect(fetch).not.toHaveBeenCalled();
});
it("shows an API refusal and keeps the current client page", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Brak dostępu." }) });
  vi.stubGlobal("fetch", fetch);
  render(<ClientPrivacyActions studioId="a" clientId="c" />);
  await userEvent.click(screen.getByRole("button", { name: "Usuń dane osobowe" }));
  await screen.findByRole("status");
  expect(screen.getByRole("status").textContent).toBe("Brak dostępu.");
  expect(push).not.toHaveBeenCalled();
});
