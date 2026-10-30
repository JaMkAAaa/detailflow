// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { OrdersBoard } from "./OrdersBoard";
import { filterOrders, ordersLabel } from "./board-demo";
import { boardOrders } from "./board-fixture";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; });

const renderBoard = (orders = boardOrders) => render(<OrdersBoard studioId="studio-a" orders={orders} clients={[{ id: "client-a", name: "Jan Test", vehicles: [{ id: "vehicle-a", label: "Toyota Corolla · WA12345" }] }]} services={[{ id: "service-a", name: "Korekta lakieru", basePrice: "2000.00" }]} onCreated={vi.fn()} onChangeStatus={vi.fn().mockResolvedValue(undefined)} />);
const region = (title: string) => screen.getByRole("region", { name: title });
const cardsIn = (title: string) => within(region(title)).queryAllByRole("link").filter((link) => link.textContent?.includes("#DF-"));

it("renders live order props in all status columns and links every card to details", () => {
  renderBoard();
  expect(screen.getByText(/8 zleceń w widoku/)).toBeTruthy();
  for (const [title, expected] of [["Przyjęte", 2], ["W trakcie", 3], ["Do odbioru", 2], ["Zakończone", 1], ["Anulowane", 0]] as const) {
    expect(cardsIn(title)).toHaveLength(expected);
    expect(within(region(title)).getByLabelText(/Liczba zleceń/).textContent).toBe(String(expected));
  }
  expect(cardsIn("W trakcie")[0]!.getAttribute("href")).toBe("/orders/DF-0248");
});

it("filters by search and service, and keeps the list view in sync", async () => {
  const user = userEvent.setup(); renderBoard();
  await user.type(screen.getByRole("searchbox"), "adam");
  expect(cardsIn("W trakcie")).toHaveLength(1);
  expect(screen.getByText(/1 zlecenie w widoku/)).toBeTruthy();
  await user.clear(screen.getByRole("searchbox"));
  await user.click(screen.getByRole("button", { name: "Lista" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(9);
  await user.click(screen.getByLabelText("Filtruj usługę"));
  await user.click(screen.getByRole("option", { name: "Mycie + wosk" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
});

it("posts a new order and keeps the form open with a 409 server error", async () => {
  const user = userEvent.setup(); renderBoard([]);
  await user.click(screen.getAllByRole("button", { name: /Nowe zlecenie/ })[0]!);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Zlecenie zostało zmienione równolegle." }), { status: 409, headers: { "Content-Type": "application/json" } })));
  await user.click(screen.getByLabelText("Klient"));
  await user.click(screen.getByRole("option", { name: "Jan Test" }));
  await user.click(screen.getByLabelText("Auto"));
  await user.click(screen.getByRole("option", { name: "Toyota Corolla · WA12345" }));
  await user.click(screen.getByRole("button", { name: "Utwórz zlecenie" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Zlecenie zostało zmienione równolegle.");
  expect(screen.getByRole("dialog", { name: "Nowe zlecenie" }).hasAttribute("open")).toBe(true);
  const [, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toMatchObject({ clientId: "client-a", vehicleId: "vehicle-a", service: "Korekta lakieru", totalGross: "2000.00" });
});

it("matches Polish plurals and case-insensitive search", () => {
  expect([1, 2, 5, 12, 22].map(ordersLabel)).toEqual(["1 zlecenie", "2 zlecenia", "5 zleceń", "12 zleceń", "22 zlecenia"]);
  expect(filterOrders(boardOrders, { query: "df-0248", service: "" })).toHaveLength(1);
  expect(filterOrders(boardOrders, { query: "DOWSKI", service: "" })).toHaveLength(1);
});
