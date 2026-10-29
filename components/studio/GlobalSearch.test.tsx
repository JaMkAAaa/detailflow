// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { GlobalSearch, GlobalSearchTrigger } from "./GlobalSearch";
import { MoreScreen } from "./MoreScreen";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("opens with Ctrl+K and shows a calm empty state without fetching", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  render(<GlobalSearch studioId="studio-a" />);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(screen.getByRole("dialog", { name: "Szukaj w aktywnym studiu" })).toBeTruthy();
  expect(screen.getByText(/Wpisz nazwę klienta/)).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled();
});

it("opens from the mobile More screen and shows explicit no-results state", async () => {
  const user = userEvent.setup();
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal("fetch", fetch);
  render(
    <>
      <GlobalSearch studioId="studio-a" />
      <MoreScreen studioId="a" choices={[{ studioId: "a", studio: { name: "Studio A" } }]} studio="Studio A" name="Ala Kowalska" location="" role="worker" attentionCount={0} />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Szukaj klienta, auta, zlecenia lub faktury" }));
  const search = screen.getByRole("searchbox", { name: "Szukaj w aktywnym studiu" });
  await user.type(search, "DF-9999");
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(
    "/api/studios/studio-a/search?q=DF-9999",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  ));
  expect(await screen.findByText("Brak wyników dla „DF-9999”.")).toBeTruthy();
  fireEvent(screen.getByRole("dialog", { name: "Szukaj w aktywnym studiu" }), new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Szukaj w aktywnym studiu" })).toBeNull());
});

it("shows the desktop shortcut trigger", () => {
  render(<GlobalSearchTrigger />);
  expect(screen.getByRole("button", { name: "Szukaj klienta, auta, zlecenia lub faktury" })).toBeTruthy();
  expect(screen.getByText("⌘K")).toBeTruthy();
});
