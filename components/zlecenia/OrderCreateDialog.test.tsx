// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { OrderCreateDialog } from "./OrderCreateDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

const client = { id: "client", name: "E2E Nabywca", vehicles: [{ id: "car", label: "E2E Auto" }] };

it("hides the order form until the studio has an active service", () => {
  render(<OrderCreateDialog studioId="studio-a" clients={[client]} services={[]} onCreated={vi.fn()} onClose={vi.fn()} />);
  expect(screen.queryByLabelText("Klient")).toBeNull();
  expect(screen.getByText("Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.")).toBeTruthy();
});

it("offers the client once an active service exists", () => {
  render(<OrderCreateDialog studioId="studio-a" clients={[client]} services={[{ id: "svc", name: "E2E Korekta", basePrice: "123.00" }]} onCreated={vi.fn()} onClose={vi.fn()} />);
  expect(screen.getByLabelText("Klient")).toBeTruthy();
  expect(screen.getByRole("option", { name: "E2E Korekta" })).toBeTruthy();
});
