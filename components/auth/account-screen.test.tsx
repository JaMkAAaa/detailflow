// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountScreen } from "./account-screen";
const mocks = vi.hoisted(() => ({ changePassword: vi.fn(), revokeOtherSessions: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/auth-client", () => ({ authClient: mocks }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
const account = {
  name: "Michał", email: "owner@example.com", trialReminderEnabled: true,
  sessions: [true, false].map(current => ({ id: String(current), current, createdAt: "2026-10-30T10:00:00Z", expiresAt: "2026-11-13T10:00:00Z", userAgent: "Browser", ipAddress: "127.0.0.1" })),
};
it("validates password confirmation and requests revocation with a successful password change", async () => {
  mocks.changePassword.mockResolvedValue({});
  const user = userEvent.setup();
  render(<AccountScreen account={account} />);
  await user.type(screen.getByLabelText("Obecne hasło"), "old-password");
  await user.type(screen.getByLabelText("Nowe hasło"), "new-password");
  await user.type(screen.getByLabelText("Powtórz nowe hasło"), "different-password");
  await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
  expect(screen.getByRole("alert").textContent).toBe("Hasła nie są takie same.");
  expect(mocks.changePassword).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Powtórz nowe hasło"));
  await user.type(screen.getByLabelText("Powtórz nowe hasło"), "new-password");
  await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  expect(mocks.changePassword).toHaveBeenCalledWith({ currentPassword: "old-password", newPassword: "new-password", revokeOtherSessions: true });
  expect((screen.getByLabelText("Obecne hasło") as HTMLInputElement).value).toBe("");
});
it("shows session errors and saves the trial preference independently of transactional mail", async () => {
  mocks.revokeOtherSessions.mockResolvedValue({ error: { code: "SESSION_EXPIRED" } });
  const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
  render(<AccountScreen account={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Wyloguj pozostałe sesje" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Zaloguj się ponownie"));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.submit(screen.getByRole("button", { name: "Zapisz preferencje" }).closest("form")!);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/account/preferences", expect.objectContaining({ body: JSON.stringify({ trialReminderEnabled: false }) })));
  expect(screen.getByText(/Maile z fakturami, resetem hasła/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /Nie pamiętasz hasła/ }).getAttribute("href")).toBe("/forgot-password");
});
