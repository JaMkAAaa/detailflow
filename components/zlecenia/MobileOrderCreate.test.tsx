// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MobileOrderCreate } from "./MobileOrderCreate";
import type { OrderClientChoice, OrderServiceChoice } from "./OrderCreateForm";

const push = vi.hoisted(() => vi.fn());
const back = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back, refresh }) }));

const clients: OrderClientChoice[] = [
  { id: "nowak", name: "Adam Nowak", vehicles: [
    { id: "porsche", label: "Porsche Panamera · WA 911PC" },
    { id: "bmw", label: "BMW X3 · WA 492BM" },
  ] },
  { id: "ewa", name: "Ewa Mazur", vehicles: [{ id: "volvo", label: "Volvo XC60 · WX 712EM" }] },
];
const services: OrderServiceChoice[] = [
  { id: "correction", name: "Korekta lakieru · 2 etapy", basePrice: "2400.00", durationMin: 300 },
  { id: "wash", name: "Mycie + wosk", basePrice: "350.00", durationMin: 120 },
];
const bays = [{ id: "bay-1", name: "Boks 01" }, { id: "bay-2", name: "Boks 02" }];
const members = [{ id: "user-1", name: "Michał Kowalski" }];

function renderForm(overrides: Partial<{ clients: OrderClientChoice[]; services: OrderServiceChoice[] }> = {}) {
  return render(
    <MobileOrderCreate
      studioId="studio-a"
      studioName="Obsidian Studio"
      clients={overrides.clients ?? clients}
      services={overrides.services ?? services}
      bays={bays}
      members={members}
    />,
  );
}

afterEach(() => {
  cleanup();
  push.mockReset();
  back.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

it("shows the selected client, service price and bay, and returns from the page", async () => {
  const user = userEvent.setup();
  renderForm();
  expect(screen.getByRole("heading", { name: "Nowe zlecenie" }).textContent).toBe("Nowe zlecenie");
  expect(screen.getByText("Obsidian Studio")).toBeTruthy();
  expect(screen.getByText("Adam Nowak")).toBeTruthy();
  expect(screen.getByText("Porsche Panamera · WA 911PC")).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Korekta lakieru/ }).getAttribute("checked") !== null || (screen.getByRole("radio", { name: /Korekta lakieru/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByLabelText("Kwota brutto").getAttribute("value") ?? (screen.getByLabelText("Kwota brutto") as HTMLInputElement).value).toBe("2400.00");
  expect(screen.getByLabelText("Razem brutto").textContent).toContain("2 400 zł");
  expect((screen.getByRole("radio", { name: "Boks 01" }) as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("button", { name: "Zamknij" }));
  expect(back.mock.calls.length + push.mock.calls.length).toBe(1);
});

it("switches service, client and car, then posts the order", async () => {
  const user = userEvent.setup();
  renderForm();
  await user.click(screen.getByRole("radio", { name: /Mycie \+ wosk/ }));
  expect((screen.getByLabelText("Kwota brutto") as HTMLInputElement).value).toBe("350.00");
  const from = (screen.getByLabelText("Termin od") as HTMLInputElement).value;
  const [hour, minute] = from.split(":").map(Number);
  const total = (hour ?? 0) * 60 + (minute ?? 0) + 120;
  const expected = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  expect((screen.getByLabelText("Termin do") as HTMLInputElement).value).toBe(expected);

  await user.click(screen.getByRole("button", { name: "Zmień" }));
  await user.type(screen.getByRole("searchbox", { name: "Szukaj klienta" }), "Adam");
  expect(screen.queryByRole("button", { name: /Ewa Mazur/ })).toBeNull();
  await user.clear(screen.getByRole("searchbox", { name: "Szukaj klienta" }));
  await user.click(screen.getByRole("button", { name: /Adam Nowak/ }));
  await user.click(screen.getByRole("button", { name: /BMW X3/ }));
  expect(screen.getByText("BMW X3 · WA 492BM")).toBeTruthy();

  await user.click(screen.getByRole("radio", { name: "Boks 02" }));
  await user.selectOptions(screen.getByLabelText("Pracownik"), "user-1");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ number: "DF-0300" }), { status: 201, headers: { "Content-Type": "application/json" } })));
  await user.click(screen.getByRole("button", { name: "Utwórz zlecenie" }));
  const [url, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(url).toBe("/api/studios/studio-a/orders");
  expect(init?.method).toBe("POST");
  const body = JSON.parse(String(init?.body));
  expect(body).toMatchObject({
    clientId: "nowak", vehicleId: "bmw", service: "Mycie + wosk", totalGross: "350.00", bayId: "bay-2", assigneeId: "user-1",
  });
  expect(body.scheduledFrom.endsWith(`T${from}`)).toBe(true);
  expect(body.scheduledTo > body.scheduledFrom).toBe(true);
  expect(push).toHaveBeenCalledWith("/orders/DF-0300");
  expect(refresh).toHaveBeenCalled();
});

it("keeps the page open when the bay is taken", async () => {
  const user = userEvent.setup();
  renderForm();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Boks jest zajęty w wybranym terminie." }), { status: 409, headers: { "Content-Type": "application/json" } })));
  await user.click(screen.getByRole("button", { name: "Utwórz zlecenie" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Boks jest zajęty w wybranym terminie.");
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Utwórz zlecenie" })).toBeTruthy();
});

it("asks for a client and a service before the form can be sent", () => {
  renderForm({ services: [] });
  expect(screen.getByText("Dodaj klienta z autem i usługę w bazie, aby utworzyć zlecenie.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Utwórz zlecenie" })).toBeNull();
});
