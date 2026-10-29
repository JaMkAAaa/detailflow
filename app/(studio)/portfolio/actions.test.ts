import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  origin: vi.fn(), context: vi.fn(), authorize: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), revalidate: vi.fn(),
  studio: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/src/server/action-origin", () => ({ assertActionOrigin: mocks.origin }));
vi.mock("@/src/server/studio/context", () => ({ requireStudio: mocks.context }));
vi.mock("@/src/server/acl", () => ({ authorizeStudio: mocks.authorize }));
vi.mock("@/src/server/portfolio/publish", () => ({ publishPhoto: mocks.publish, unpublishPhoto: mocks.unpublish }));
vi.mock("@/lib/db/client", () => ({ platformDb: { studio: { findUnique: mocks.studio } } }));
import { publishPortfolioPhoto, unpublishPortfolioPhoto } from "./actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({ studioId: "a", user: { id: "user" } });
  mocks.publish.mockResolvedValue({ id: "photo" });
  mocks.unpublish.mockResolvedValue({ id: "photo", published: false });
  mocks.studio.mockResolvedValue({ slug: "obsidian-studio" });
});

it("checks Origin and the active studio before a portfolio write", async () => {
  mocks.origin.mockRejectedValueOnce(new Error("Origin"));
  expect(await publishPortfolioPhoto("a", "photo", {})).toEqual({ ok: false, error: "Origin" });
  expect(mocks.context).not.toHaveBeenCalled();
  expect(await publishPortfolioPhoto("b", "photo", { plateVisible: true })).toMatchObject({ ok: false });
  expect(mocks.authorize).not.toHaveBeenCalled();
});

it("requires a writable subscription to publish, but takedown stays available and refreshes the public page", async () => {
  mocks.authorize.mockRejectedValueOnce(new Error("Tylko odczyt"));
  expect(await publishPortfolioPhoto("a", "photo", { plateVisible: true })).toEqual({ ok: false, error: "Tylko odczyt" });
  expect(mocks.authorize).toHaveBeenCalledWith("user", "a", "portfolio:manage", true);
  expect(mocks.publish).not.toHaveBeenCalled();
  expect((await unpublishPortfolioPhoto("a", "photo")).ok).toBe(true);
  expect(mocks.authorize).toHaveBeenLastCalledWith("user", "a", "portfolio:manage", false);
  expect(mocks.unpublish).toHaveBeenCalledWith("a", "photo", "user");
  expect(mocks.revalidate.mock.calls).toEqual([["/portfolio"], ["/realizacje/obsidian-studio"]]);
});
