import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ origin: vi.fn(), context: vi.fn(), authorize: vi.fn(), create: vi.fn(), correct: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/src/server/action-origin", () => ({ assertActionOrigin: mocks.origin }));
vi.mock("@/src/server/studio/context", () => ({ requireStudio: mocks.context }));
vi.mock("@/src/server/acl", () => ({ authorizeStudio: mocks.authorize }));
vi.mock("@/src/server/magazyn/inventory", () => ({ createChemical: mocks.create, correctChemical: mocks.correct }));
import { createChemicalAction, correctChemicalAction } from "./actions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ studioId: "a", user: { id: "user" } });
  mocks.create.mockResolvedValue({ id: "chemical" });
});
it("checks Origin before session or writes and rejects changed active studio", async () => {
  mocks.origin.mockRejectedValueOnce(new Error("Origin"));
  expect(await createChemicalAction("a", {})).toEqual({ ok: false, error: "Origin" });
  expect(mocks.context).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect((await createChemicalAction("b", {})).ok).toBe(false);
  expect(mocks.authorize).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("enforces write authorization and revalidates inventory and dashboard only on success", async () => {
  mocks.authorize.mockRejectedValueOnce(new Error("Read only"));
  expect(await correctChemicalAction("a", "chemical", {})).toEqual({ ok: false, error: "Read only" });
  expect(mocks.authorize).toHaveBeenCalledWith("user", "a", "inventory:manage", true);
  expect(mocks.correct).not.toHaveBeenCalled();
  expect(mocks.revalidate).not.toHaveBeenCalled();
  expect((await createChemicalAction("a", { name: "Pasta" })).ok).toBe(true);
  expect(mocks.create).toHaveBeenCalledWith("a", { name: "Pasta" });
  expect(mocks.revalidate.mock.calls).toEqual([["/inventory"], ["/"]]);
});
