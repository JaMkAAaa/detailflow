// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ServicesScreen, type ServiceActions, type ServiceRow } from "./ServicesScreen";

afterEach(cleanup);

const row: ServiceRow = {
  id: "svc-1",
  name: "Korekta",
  description: "Dwa etapy",
  basePrice: "2000.00",
  durationMin: 400,
  active: true,
};

function actions(partial: Partial<ServiceActions> = {}): ServiceActions {
  return {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    ...partial,
  };
}

it("shows an empty catalog instead of a missing page", () => {
  render(<ServicesScreen studioId="studio-a" services={[]} actions={actions()} />);
  expect(screen.getByRole("heading", { name: "Usługi i cennik" })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("Brak usług w cenniku");
});

it("lists the gross price and hides a service without dropping the row", async () => {
  const user = userEvent.setup();
  const update = vi.fn().mockResolvedValue({ ok: true, value: { ...row, active: false } });
  render(<ServicesScreen studioId="studio-a" services={[row]} actions={actions({ update })} />);
  expect(screen.getByText(/2 000 zł/)).toBeTruthy();
  expect(screen.getByText(/400 min/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Ukryj: Korekta" }));
  expect(update).toHaveBeenCalledWith("studio-a", "svc-1", { active: false });
  expect(screen.getByText("Ukryta")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pokaż: Korekta" })).toBeTruthy();
});

it("adds a service and deletes it only after confirmation", async () => {
  const user = userEvent.setup();
  const created: ServiceRow = { id: "svc-2", name: "Mycie", description: "", basePrice: "250.00", durationMin: 50, active: true };
  const create = vi.fn().mockResolvedValue({ ok: true, value: created });
  const remove = vi.fn().mockResolvedValue({ ok: true, value: undefined });
  render(<ServicesScreen studioId="studio-a" services={[]} actions={actions({ create, remove })} />);
  await user.type(screen.getByLabelText("Nazwa"), "Mycie");
  await user.type(screen.getByLabelText("Cena bazowa brutto (PLN)"), "250,00");
  await user.clear(screen.getByLabelText("Czas bazowy (min)"));
  await user.type(screen.getByLabelText("Czas bazowy (min)"), "50");
  await user.click(screen.getByRole("button", { name: "Dodaj usługę" }));
  expect(create).toHaveBeenCalledWith("studio-a", {
    name: "Mycie", description: "", basePrice: "250.00", durationMin: 50, active: true,
  });
  expect(screen.queryByRole("status")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Usuń: Mycie" }));
  expect(remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Potwierdź usunięcie: Mycie" }));
  expect(remove).toHaveBeenCalledWith("studio-a", "svc-2");
  expect(screen.getByRole("status").textContent).toContain("Brak usług w cenniku");
});

it("shows a validation error and keeps the typed price", async () => {
  const user = userEvent.setup();
  const create = vi.fn().mockResolvedValue({ ok: false, error: "Nieprawidłowe dane." });
  render(<ServicesScreen studioId="studio-a" services={[]} actions={actions({ create })} />);
  await user.type(screen.getByLabelText("Nazwa"), "Zła");
  await user.type(screen.getByLabelText("Cena bazowa brutto (PLN)"), "10.555");
  await user.click(screen.getByRole("button", { name: "Dodaj usługę" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Nieprawidłowe dane.");
  expect((screen.getByLabelText("Cena bazowa brutto (PLN)") as HTMLInputElement).value).toBe("10.555");
});
