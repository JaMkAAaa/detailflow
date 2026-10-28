// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { KsefEnvForm } from "./KsefEnvForm";

const mocks = vi.hoisted(() => ({
  action: vi.fn<(prev: { error: string }, form: FormData) => Promise<{ error: string }>>(async () => ({ error: "" })),
}));
vi.mock("@/app/(studio)/invoices/actions", () => ({ setKsefEnvAction: mocks.action }));

afterEach(() => {
  cleanup();
  mocks.action.mockClear();
});

it("asks for confirmation before an environment change deletes the token", async () => {
  const user = userEvent.setup();
  render(<KsefEnvForm env="test" prodAllowed tokenSet />);
  expect(screen.queryByRole("dialog", { name: "Zmiana środowiska KSeF" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Potwierdź zmianę" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Środowisko PROD" }));
  const dialog = screen.getByRole("dialog", { name: "Zmiana środowiska KSeF" });
  expect(dialog.textContent).toContain("usuwa zapisany token");
  expect(mocks.action).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Potwierdź zmianę" }));
  expect(mocks.action).toHaveBeenCalledTimes(1);
  expect(mocks.action.mock.calls[0]![1].get("env")).toBe("production");
});

it("closes the confirmation without changing the environment", async () => {
  const user = userEvent.setup();
  render(<KsefEnvForm env="production" prodAllowed tokenSet={false} />);
  await user.click(screen.getByRole("button", { name: "Środowisko TEST" }));
  expect(screen.getByRole("dialog").textContent).toContain("usuwa zapisany token");
  await user.click(screen.getByRole("button", { name: "Anuluj" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.action).not.toHaveBeenCalled();
});

it("does not offer production while the platform flag is off", () => {
  render(<KsefEnvForm env="test" prodAllowed={false} tokenSet />);
  expect(screen.getByRole("button", { name: "Środowisko PROD" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("dialog")).toBeNull();
});
