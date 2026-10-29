// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDashboardActions } from "./use-dashboard-actions";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("creates an order portal URL and clears it when dismissed without persisting it", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ path: "/p/once_only_secret" }) });
  const persist = vi.spyOn(Storage.prototype, "setItem");
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useDashboardActions("studio-a"));
  await act(() => result.current.act("order-a", "portal-links"));
  expect(fetcher).toHaveBeenCalledWith("/api/studios/studio-a/portal-links", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workOrderId: "order-a" }),
  });
  expect(result.current.notice?.description).toBe(`${window.location.origin}/p/once_only_secret`);
  expect(persist).not.toHaveBeenCalled();
  act(() => result.current.setNotice(null));
  expect(result.current.notice).toBeNull();
  persist.mockRestore();
});

it("prevents a second request while the first stage change is pending", async () => {
  let finish!: (response: unknown) => void;
  const fetcher = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const { result } = renderHook(() => useDashboardActions("studio-a"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.act("order-a", "advance"); });
  await act(() => result.current.act("order-a", "advance"));
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => { finish({ ok: true, json: async () => ({}) }); await pending; });
  expect(result.current.busy).toBe(false);
});
