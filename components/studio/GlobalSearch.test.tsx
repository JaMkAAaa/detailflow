// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { GlobalSearch, GlobalSearchTrigger } from "./GlobalSearch";
import { MoreScreen } from "./MoreScreen";

const matchingResults = [
  { type: "client", title: "Michał Kowalski", subtitle: "512 345 678", href: "/customers/c1" },
  { type: "vehicle", title: "BMW X5", subtitle: "WA 12345 · Michał Kowalski", href: "/customers/c1" },
  { type: "order", title: "DF-0248", subtitle: "Korekta lakieru · BMW X5", href: "/orders/DF-0248" },
  { type: "invoice", title: "FV/41/10/2026", subtitle: "Michał Kowalski · PROD", href: "/invoices/FV-41" },
];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockFetch(value: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => value });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function input() {
  return screen.getByRole("combobox", { name: "Szukaj w aktywnym studiu" });
}

function openPalette() {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
}

it("opens with Ctrl+K and shows a useful empty state without fetching", () => {
  const fetchMock = mockFetch([]);
  render(<GlobalSearch studioId="studio-a" />);
  openPalette();

  expect(screen.getByRole("dialog", { name: "Szukaj w aktywnym studiu" })).toBeTruthy();
  expect(screen.getByText(/Zacznij od nazwiska klienta/)).toBeTruthy();
  expect(screen.getByText("Szybkie akcje")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Nowe zlecenie/ }).getAttribute("href")).toBe("/orders?new=1");
  expect(screen.getByRole("link", { name: /Dodaj klienta/ }).getAttribute("href")).toBe("/customers/new");
  expect(fetchMock).not.toHaveBeenCalled();
});

it("groups results by type, filters with counts and keeps the studio context", async () => {
  mockFetch(matchingResults);
  render(<GlobalSearch studioId="studio-a" studioName="Obsidian Studio" />);
  openPalette();
  fireEvent.change(input(), { target: { value: "kowalski" } });

  await screen.findByText("DF-0248");
  expect(screen.getByRole("group", { name: "Klienci" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Auta" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Zlecenia" })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Faktury" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Wszystko (4)" })).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Klienci (1)" }));

  expect(screen.queryByText("DF-0248")).toBeNull();
  expect(screen.getAllByText("1 z 4 wyników").length).toBeGreaterThan(0);
  expect(screen.getByText("Obsidian Studio")).toBeTruthy();
});

it("moves the active result with the keyboard and keeps aria-activedescendant in sync", async () => {
  mockFetch(matchingResults.slice(0, 3));
  render(<GlobalSearch studioId="studio-a" />);
  openPalette();
  fireEvent.change(input(), { target: { value: "kowalski" } });

  await screen.findByText("DF-0248");
  expect(input().getAttribute("aria-activedescendant")).toBe("global-search-option-0");
  expect(screen.getByRole("option", { name: /^Michał Kowalski,/ }).getAttribute("aria-selected")).toBe("true");

  fireEvent.keyDown(input(), { key: "ArrowDown" });
  expect(input().getAttribute("aria-activedescendant")).toBe("global-search-option-1");
  expect(screen.getByRole("option", { name: /^BMW X5,/ }).getAttribute("aria-selected")).toBe("true");

  fireEvent.keyDown(input(), { key: "End" });
  expect(input().getAttribute("aria-activedescendant")).toBe("global-search-option-2");

  fireEvent.keyDown(input(), { key: "Home" });
  expect(input().getAttribute("aria-activedescendant")).toBe("global-search-option-0");
});

it("shows the loading skeleton while the debounced request is pending", () => {
  vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
  render(<GlobalSearch studioId="studio-a" />);
  openPalette();
  fireEvent.change(input(), { target: { value: "kowalski" } });

  expect(screen.getByText("Wyszukiwanie…")).toBeTruthy();
  expect(document.getElementById("global-search-results")?.getAttribute("aria-busy")).toBe("true");
});

it("shows an error with retry and recovers", async () => {
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce({ ok: true, json: async () => [matchingResults[0]] });
  vi.stubGlobal("fetch", fetchMock);

  render(<GlobalSearch studioId="studio-a" />);
  openPalette();
  fireEvent.change(input(), { target: { value: "kowalski" } });

  expect(await screen.findByText("Nie udało się wyszukać")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));

  expect(await screen.findByRole("option", { name: /^Michał Kowalski,/ })).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("loads recents for the active studio and hides invoices from workers", async () => {
  const now = Date.now();
  window.localStorage.setItem("detailflow:global-search:recent:studio-a", JSON.stringify([
    { type: "invoice", title: "FV/41/10/2026", subtitle: "Michał Kowalski", href: "/invoices/FV-41", savedAt: now },
    { type: "client", title: "Anna Nowak", subtitle: "604 111 222", href: "/customers/c2", savedAt: now - 1_000 },
  ]));

  render(<GlobalSearch studioId="studio-a" canInvoice={false} />);
  openPalette();

  expect(await screen.findByText("Anna Nowak")).toBeTruthy();
  expect(screen.queryByText("FV/41/10/2026")).toBeNull();
  expect(screen.queryByText("FV/41")).toBeNull();
  expect(screen.getByText("Ostatnio otwierane")).toBeTruthy();
});

it("opens from the mobile More screen and shows the no-results state", async () => {
  const user = userEvent.setup();
  const fetchMock = mockFetch([]);
  render(
    <>
      <GlobalSearch studioId="studio-a" />
      <MoreScreen studioId="a" choices={[{ studioId: "a", studio: { name: "Studio A" } }]} studio="Studio A" name="Ala Kowalska" location="" role="worker" attentionCount={0} />
    </>,
  );

  await user.click(screen.getByRole("button", { name: "Szukaj klienta, auta, zlecenia lub faktury" }));
  fireEvent.change(input(), { target: { value: "DF-9999" } });

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
    "/api/studios/studio-a/search?q=DF-9999",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  ));
  expect(await screen.findByText("Brak wyników dla „DF-9999”")).toBeTruthy();

  fireEvent(screen.getByRole("dialog", { name: "Szukaj w aktywnym studiu" }), new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Szukaj w aktywnym studiu" })).toBeNull());
});

it("closes with Escape and clears the query", async () => {
  mockFetch(matchingResults);
  render(<GlobalSearch studioId="studio-a" />);
  openPalette();
  fireEvent.change(input(), { target: { value: "kowalski" } });
  await screen.findByText("DF-0248");

  fireEvent.keyDown(input(), { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Szukaj w aktywnym studiu" })).toBeNull());
  openPalette();
  expect((input() as HTMLInputElement).value).toBe("");
});

it("shows the desktop shortcut trigger", () => {
  render(<GlobalSearchTrigger />);
  expect(screen.getByRole("button", { name: "Szukaj klienta, auta, zlecenia lub faktury" })).toBeTruthy();
  expect(screen.getByText("⌘K")).toBeTruthy();
});
