// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MoreScreen } from "./MoreScreen";

const choices = [
  { studioId: "a", studio: { name: "Studio A" } },
  { studioId: "b", studio: { name: "Studio B" } },
];
const props = { studio: "Studio A", studioId: "a", choices, name: "Ala", location: "", role: "worker" as const, attentionCount: 0 };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("switches from the mobile More screen and reloads the dashboard after the cookie is saved", async () => {
  vi.stubGlobal("innerWidth", 390);
  const user = userEvent.setup();
  const assign = vi.fn();
  const realWindow = window;
  vi.stubGlobal("window", new Proxy(realWindow, {
    get(target, key) { return key === "location" ? { assign } : Reflect.get(target, key); },
  }));
  let complete!: (value: Response) => void;
  const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { complete = resolve; }));
  vi.stubGlobal("fetch", fetchMock);
  render(<MoreScreen {...props} />);
  const picker = screen.getByRole("combobox", { name: "Wybierz studio" }) as HTMLSelectElement;
  await user.selectOptions(picker, "b");
  expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/studios/active", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId: "b" }),
  });
  expect(picker.disabled).toBe(true);
  expect(assign).not.toHaveBeenCalled();
  complete(new Response(JSON.stringify({ studioId: "b" }), { status: 200 }));
  await waitFor(() => expect(assign).toHaveBeenCalledExactlyOnceWith("/"));
});

it.each(["forbidden", "network"])("keeps the active studio and allows retry after %s failure", async (failure) => {
  const user = userEvent.setup();
  const fetchMock = vi.fn();
  if (failure === "forbidden") fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
  else fetchMock.mockRejectedValue(new Error("network"));
  vi.stubGlobal("fetch", fetchMock);
  render(<MoreScreen {...props} />);
  const picker = screen.getByRole("combobox", { name: "Wybierz studio" }) as HTMLSelectElement;
  await user.selectOptions(picker, "b");
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(picker.value).toBe("a");
  expect(picker.disabled).toBe(false);
  await user.selectOptions(picker, "b");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("shows a single studio without a selection control", () => {
  render(<MoreScreen {...props} choices={choices.slice(0, 1)} />);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.getByRole("region", { name: "Aktywne studio" }).textContent).toBe("Studio A");
});
