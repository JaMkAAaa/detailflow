// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import type { ClientProfile, ClientRow, ClientsPage } from "@/src/server/klienci/directory";
import { CLIENTS_PER_PAGE } from "@/src/server/klienci/query";
import { ClientsScreen } from "./ClientsScreen";
import { clientsLabel, formatSince, pageItems, visitsLabel } from "./format";

beforeAll(() => {
  // jsdom has no modal dialog support.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});
afterEach(cleanup);

const row = (i: number, extra: Partial<ClientRow> = {}): ClientRow => ({
  id: `c${i}`,
  name: `Klient ${i}`,
  phone: `+48 600 000 ${String(i).padStart(3, "0")}`,
  isRegular: i % 2 === 0,
  plates: [`WX ${i}K`],
  lastVisit: new Date("2026-10-23T08:00:00Z"),
  totalGross: "1050.00",
  ...extra,
});

const nowak: ClientProfile = {
  id: "c1",
  name: "Adam Nowak",
  phone: "+48 600 123 456",
  email: "adam.nowak@example.com",
  isRegular: true,
  coatingService: false,
  since: new Date("2025-03-14T11:00:00Z"),
  visitCount: 6,
  vehicles: [
    { id: "v1", make: "Porsche", model: "Panamera", plate: "WA 911PC", year: 2021, color: "czarny", lastVisit: null, active: { number: "DF-0248", status: "in_progress" } },
    { id: "v2", make: "BMW", model: "X3", plate: "WA 492BM", year: 2019, color: "biały", lastVisit: new Date("2026-08-14T08:00:00Z"), active: null },
  ],
  visits: [
    { number: "DF-0248", at: new Date("2026-10-24T06:00:00Z"), totalGross: "4800.00", service: "Korekta + ceramika", status: "in_progress", vehicle: "Porsche Panamera" },
    { number: "DF-0188", at: new Date("2026-08-14T08:00:00Z"), totalGross: "450.00", service: "Mycie premium", status: "completed", vehicle: "BMW X3" },
  ],
};

const page = (extra: Partial<ClientsPage> = {}): ClientsPage => ({
  query: { q: "", filter: "all", page: 1, client: null },
  rows: Array.from({ length: CLIENTS_PER_PAGE }, (_, i) => row(i + 1, i === 0 ? { name: "Adam Nowak", totalGross: "12350.00", plates: ["WA 911PC", "WA 492BM"] } : {})),
  total: 124,
  vehicleTotal: 168,
  counts: { all: 124, regular: 79, coating: 3 },
  page: 1,
  pages: 7,
  selected: nowak,
  ...extra,
});

it("renders the Figma list: counts, 20 rows, selected row, money and extra cars", () => {
  render(<ClientsScreen data={page()} />);
  expect(screen.getByRole("heading", { level: 1, name: "Klienci i auta" })).toBeTruthy();
  expect(screen.getByText("124 klientów · 168 aut")).toBeTruthy();
  const chips = within(screen.getByRole("group", { name: "Filtr klientów" })).getAllByRole("link");
  expect(chips.map((chip) => chip.textContent)).toEqual(["Wszyscy  124", "Stali klienci  79", "Serwis powłoki  3"]);
  expect(chips[0]!.getAttribute("aria-current")).toBe("true");
  expect(chips[1]!.getAttribute("href")).toBe("/customers?filter=regular");

  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("link")).toHaveLength(20);
  const selected = within(table).getByRole("link", { name: /Adam Nowak/ });
  expect(selected.getAttribute("aria-current")).toBe("true");
  expect(selected.getAttribute("href")).toBe("/customers?client=c1");
  expect(selected.closest("td")!.className).toMatch(/border-df-lime/);
  expect(selected.closest("tr")!.textContent).toContain("WA 911PC +1");
  expect(selected.closest("tr")!.textContent).toContain("12 350 zł");
  expect(selected.closest("tr")!.textContent).toContain("23.10.2026");
  expect(screen.getByText("1–20 z 124 klientów · 20 na stronę")).toBeTruthy();
});

it("shows Adam Nowak's card like Figma", () => {
  render(<ClientsScreen data={page()} />);
  const card = screen.getByRole("complementary");
  expect(within(card).getByRole("heading", { level: 2, name: "Adam Nowak" })).toBeTruthy();
  expect(within(card).getByText("Stały klient")).toBeTruthy();
  expect(within(card).getByText("adam.nowak@example.com")).toBeTruthy();
  expect(within(card).getByText("Klient od marca 2025 · 6 wizyt")).toBeTruthy();
  const badge = within(card).getByRole("link", { name: "Zlecenie w trakcie: #DF-0248" });
  expect(badge.getAttribute("href")).toBe("/orders/DF-0248");
  expect(within(card).getByText("BMW X3 · WA 492BM")).toBeTruthy();
  expect(within(card).getByText("2019 · biały · ostatnia wizyta 14.08")).toBeTruthy();
  const visits = within(within(card).getByRole("region", { name: "Ostatnie wizyty" })).getAllByRole("listitem");
  expect(visits.map((v) => v.textContent)).toEqual([
    "24.10.2026  ·  4 800 złKorekta + ceramika · w trakcie",
    "14.08.2026  ·  450 złBMW X3 · Mycie premium",
  ]);
});

it("pagination keeps the filter and the search, and does not render a prev link on page 1", () => {
  const data = page({ query: { q: "an", filter: "regular", page: 1, client: null } });
  render(<ClientsScreen data={data} />);
  const nav = screen.getByRole("navigation", { name: "Stronicowanie" });
  expect(within(nav).queryByRole("link", { name: "Poprzednia strona" })).toBeNull();
  expect(within(nav).getByRole("link", { name: "Strona 1" }).getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Strona 7" }).getAttribute("href")).toBe("/customers?q=an&filter=regular&page=7");
  expect(within(nav).getByRole("link", { name: "Następna strona" }).getAttribute("href")).toBe("/customers?q=an&filter=regular&page=2");
});

it("shows only numbers for a short list and nothing for a single page", () => {
  const { rerender } = render(<ClientsScreen data={page({ pages: 1, total: 4, rows: [row(1)] })} />);
  expect(screen.queryByRole("navigation", { name: "Stronicowanie" })).toBeNull();
  expect(screen.getByText("1–1 z 4 klientów · 20 na stronę")).toBeTruthy();
  rerender(<ClientsScreen data={page({ page: 4, pages: 12, query: { q: "", filter: "all", page: 4, client: null } })} />);
  const nav = screen.getByRole("navigation", { name: "Stronicowanie" });
  expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["‹", "1", "2", "3", "4", "5", "12", "›"]);
});

it("search form is a GET form that keeps the active filter", () => {
  render(<ClientsScreen data={page({ query: { q: "Nowak", filter: "coating", page: 1, client: null } })} />);
  const form = screen.getByRole("search");
  expect(form.getAttribute("action")).toBe("/customers");
  expect((within(form).getByRole("searchbox") as HTMLInputElement).value).toBe("Nowak");
  expect(form.querySelector<HTMLInputElement>("input[name=filter]")!.value).toBe("coating");
});

it("shows a no-results state with a link that clears filters, and an empty card", () => {
  render(<ClientsScreen data={page({ query: { q: "xyz", filter: "regular", page: 1, client: null }, rows: [], total: 0, vehicleTotal: 0, pages: 1, selected: null })} />);
  expect(screen.getByRole("heading", { name: "Nie znaleziono „xyz”" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Wyczyść filtry" }).getAttribute("href")).toBe("/customers");
  expect(screen.queryByRole("table")).toBeNull();
  expect(screen.getByText(/Wybierz klienta z listy/)).toBeTruthy();
});

it("add client goes to the create form", () => {
  render(<ClientsScreen data={page()} />);
  expect(screen.getByRole("link", { name: "＋ Dodaj klienta" }).getAttribute("href")).toBe("/customers/new");
});

it("formats Polish plurals, genitive month and page windows", () => {
  expect(clientsLabel(1)).toBe("1 klient");
  expect(visitsLabel(1)).toBe("1 wizyta");
  expect([2, 4, 22].map(visitsLabel)).toEqual(["2 wizyty", "4 wizyty", "22 wizyty"]);
  expect([5, 12, 14, 112].map(visitsLabel)).toEqual(["5 wizyt", "12 wizyt", "14 wizyt", "112 wizyt"]);
  expect(formatSince(new Date("2025-03-14T11:00:00Z"))).toBe("marca 2025");
  expect(pageItems(1, 7)).toEqual([1, 2, "…", 7]);
  expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  expect(pageItems(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
  expect(pageItems(1, 1)).toEqual([1]);
  expect(pageItems(7, 7)).toEqual([1, "…", 6, 7]);
});
