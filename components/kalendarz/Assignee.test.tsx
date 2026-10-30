// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { BookingForm } from "./BookingForm";
import { DayGrid } from "./DayGrid";
import { MobileDayView } from "./MobileDayView";
import { matchesEmployee, UNASSIGNED, type Booking } from "./demo";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace: vi.fn() }) }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); refresh.mockClear(); });

const bays = [{ id: "bay-1", name: "Boks 01", sort: 1 }, { id: "bay-2", name: "Boks 02", sort: 2 }];
const members = [{ id: "user-a", name: "Michał" }, { id: "user-b", name: "Kamil" }];
const base = { number: "DF-1", customer: "Klient", service: "Mycie", status: "scheduled" as const, start: 0, end: 0 };
const events: Booking[] = [
  { ...base, id: "o1", bay: 1, vehicle: "Audi A", employee: "Michał", assigneeId: "user-a", from: "2026-10-27T08:00", to: "2026-10-27T10:00" },
  { ...base, id: "o2", bay: 1, vehicle: "BMW B", employee: "", assigneeId: null, from: "2026-10-27T13:00", to: "2026-10-27T15:00" },
  { ...base, id: "o3", bay: 2, vehicle: "Fiat C", employee: "Kamil", assigneeId: "user-b", from: "2026-10-27T09:00", to: "2026-10-27T10:00" },
];
const clients = [{ id: "client-1", name: "Marta", vehicles: [{ id: "vehicle-1", label: "Fiat Panda · WA1" }] }];
const services = [{ id: "service-1", name: "Mycie", basePrice: "250.00" }];
const form = <BookingForm studioId="studio-1" bays={bays} members={members} clients={clients} services={services}
  orders={[{ id: "o2", number: "DF-1", bayId: "bay-1", assigneeId: null, from: "2026-10-27T13:00", to: "2026-10-27T15:00" }]} />;
const grid = <DayGrid events={events} bays={bays} members={members} today="2026-10-27" nowMinutes={0} reservationForm={form} />;

it("matches members, the unassigned bucket and demo names with one rule", () => {
  expect(events.map((event) => matchesEmployee(event, "user-a", true))).toEqual([true, false, false]);
  expect(events.map((event) => matchesEmployee(event, UNASSIGNED, true))).toEqual([false, true, false]);
  expect(events.map((event) => matchesEmployee(event, "", true))).toEqual([true, true, true]);
  expect(matchesEmployee({ ...base, id: "d", bay: 1, vehicle: "", employee: "Kamil" }, "Kamil", false)).toBe(true);
});

it("filters the day by team member and by unassigned orders", async () => {
  const user = userEvent.setup();
  render(grid);
  const filter = screen.getByLabelText("Filtruj pracownika");
  await user.click(filter);
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Wszystkie osoby", "Nieprzypisane", "Michał", "Kamil"]);
  expect(screen.getAllByRole("link")).toHaveLength(3);
  await user.click(screen.getByRole("option", { name: "Michał" }));
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([expect.stringContaining("Audi A")]);
  await user.click(filter);
  await user.click(screen.getByRole("option", { name: "Nieprzypisane" }));
  expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([expect.stringContaining("BMW B")]);
  await user.click(filter);
  await user.click(screen.getByRole("option", { name: "Wszystkie osoby" }));
  expect(screen.getAllByRole("link")).toHaveLength(3);
  expect(screen.getByText(/08:00–10:00 · Klient · Michał/)).toBeTruthy();
});

it("opens a new order from a free window with bay and hours filled and keeps a 409 in the form", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Boks jest zajęty w wybranym terminie." }), { status: 409, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  render(grid);
  await user.click(screen.getByRole("button", { name: "+ Wolne 10:00–13:00 · Zarezerwuj" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Nowe zlecenie" }).getAttribute("aria-pressed")).toBe("true");
  expect(within(dialog).getByLabelText("Boks").getAttribute("data-value")).toBe("bay-1");
  expect((within(dialog).getByLabelText("Termin od") as HTMLInputElement).value).toBe("2026-10-27T10:00");
  expect((within(dialog).getByLabelText("Termin do") as HTMLInputElement).value).toBe("2026-10-27T13:00");
  expect(within(dialog).getByLabelText("Pracownik").getAttribute("data-value")).toBe("");
  await user.click(within(dialog).getByLabelText("Pracownik"));
  await user.click(screen.getByRole("option", { name: "Kamil" }));
  await user.click(within(dialog).getByRole("button", { name: "Utwórz zlecenie" }));

  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe("/api/studios/studio-1/orders");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({ bayId: "bay-1", scheduledFrom: "2026-10-27T10:00", scheduledTo: "2026-10-27T13:00", assigneeId: "user-b", clientId: "client-1", vehicleId: "vehicle-1" });
  expect(body).not.toHaveProperty("slotId");
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Boks jest zajęty w wybranym terminie.");
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(refresh).not.toHaveBeenCalled();
  expect((within(dialog).getByLabelText("Termin od") as HTMLInputElement).value).toBe("2026-10-27T10:00");
});

it("refreshes and closes the dialog after a successful create", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "new" }), { status: 201, headers: { "Content-Type": "application/json" } })));
  render(grid);
  await user.click(screen.getByRole("button", { name: "+ Wolne 10:00–13:00 · Zarezerwuj" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Utwórz zlecenie" }));
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

it("starts on the existing-order tab from „Nowa rezerwacja” and sends the assignee with the booking", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Boks jest zajęty w wybranym terminie." }), { status: 409, headers: { "Content-Type": "application/json" } }))
    .mockResolvedValue(new Response(JSON.stringify({ id: "o2" }), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  render(grid);
  await user.click(screen.getByRole("button", { name: /Nowa rezerwacja/ }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("button", { name: "Istniejące zlecenie" }).getAttribute("aria-pressed")).toBe("true");
  await user.click(within(dialog).getByLabelText("Pracownik"));
  await user.click(screen.getByRole("option", { name: "Michał" }));
  await user.click(within(dialog).getByRole("button", { name: "Zapisz rezerwację" }));
  expect(fetcher.mock.calls[0]![0]).toBe("/api/studios/studio-1/bookings/o2");
  expect(fetcher.mock.calls[0]![1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ bayId: "bay-1", assigneeId: "user-a" });
  expect((await within(dialog).findByRole("alert")).textContent).toBe("Boks jest zajęty w wybranym terminie.");
  await user.click(within(dialog).getByLabelText("Pracownik"));
  await user.click(screen.getByRole("option", { name: "Nieprzypisane" }));
  await user.click(within(dialog).getByRole("button", { name: "Zapisz rezerwację" }));
  expect(JSON.parse(fetcher.mock.calls[1]![1].body)).toMatchObject({ assigneeId: null });
});

it("opens the same prefilled new-order form from the free window on mobile", async () => {
  const user = userEvent.setup();
  render(<MobileDayView events={events} bays={bays} today="2026-10-27" nowMinutes={0} reservationForm={form} />);
  await user.click(screen.getByRole("button", { name: /Wolne 3 h · Boks 01/ }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByLabelText("Boks").getAttribute("data-value")).toBe("bay-1");
  expect((within(dialog).getByLabelText("Termin od") as HTMLInputElement).value).toBe("2026-10-27T10:00");
  expect((within(dialog).getByLabelText("Termin do") as HTMLInputElement).value).toBe("2026-10-27T13:00");
});
