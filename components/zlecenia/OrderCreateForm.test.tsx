// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrderCreateForm } from "./OrderCreateForm";

afterEach(cleanup);

it("tells the user when the studio has no active services", () => {
  render(<OrderCreateForm studioId="studio-a" clients={[{ id: "client", name: "Jan", vehicles: [{ id: "car", label: "Porsche" }] }]} services={[]} onCreated={vi.fn()} />);
  expect(screen.getByRole("status").textContent).toContain("Brak aktywnych usług w cenniku.");
});

it("offers only the services it was given", () => {
  render(<OrderCreateForm studioId="studio-a" clients={[{ id: "client", name: "Jan", vehicles: [{ id: "car", label: "Porsche" }] }]} services={[{ id: "wash", name: "Mycie", basePrice: "250.00" }]} onCreated={vi.fn()} />);
  expect(screen.getByRole("option", { name: "Mycie" })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
