// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OrdersScreen } from "./OrdersScreen";
import { postOrderStatus } from "./orders-client";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const row = {
  id: "order-a", number: "DF-1001", clientId: "client-a", vehicleId: "vehicle-a", service: "Korekta lakieru",
  status: "accepted", stage: 1, totalGross: "1250.50", scheduledFrom: "2026-10-28T09:00:00.000Z", scheduledTo: "2026-10-28T11:00:00.000Z",
  client: { id: "client-a", name: "Marta Nowa", phone: null, email: null },
  vehicle: { id: "vehicle-a", make: "Toyota", model: "Corolla", plate: "WA12345" }, bay: null,
};

it("loads order cards from GET /orders and displays database fields", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([row]), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<OrdersScreen studioId="studio-a" clients={[]} services={[]} />);
  const links = await screen.findAllByRole("link", { name: /Toyota Corolla/ });
  const link = links[0]!;
  expect(link.getAttribute("href")).toBe("/orders/DF-1001");
  expect(link.textContent).toContain("Marta Nowa");
  expect(link.textContent).toContain("1 250,50 zł");
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-a/orders");
});

it("posts a status transition and preserves the API conflict message", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Nieprawidłowe przejście." }), { status: 409, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  await expect(postOrderStatus("studio-a", "order-a", "ready_for_pickup")).rejects.toThrow("Nieprawidłowe przejście.");
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-a/orders/order-a/status", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "ready_for_pickup" }),
  });
});
