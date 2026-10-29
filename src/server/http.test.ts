import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(), authorize: vi.fn(), consume: vi.fn(),
}));
vi.mock("../../lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("../../lib/env", () => ({ env: { APP_URL: "http://localhost:3000" } }));
vi.mock("./acl", async importOriginal => ({ ...await importOriginal<typeof import("./acl")>(), authorizeStudio: mocks.authorize }));
vi.mock("./rate-limit", async importOriginal => ({ ...await importOriginal<typeof import("./rate-limit")>(), sharedCounter: () => ({ consume: mocks.consume }) }));
import { apiError, apiStudio } from "./http";
import { counterKey } from "./rate-limit";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "user-1" } });
  mocks.authorize.mockResolvedValue({ db: {}, member: {} });
  mocks.consume.mockResolvedValue({ allowed: true, retryAfter: null });
});

it("limits writes by user across studios, without sharing a bucket by IP", async () => {
  const req = new Request("http://localhost/api/studios/a/orders", { method: "POST" });
  await apiStudio(req, "a");
  await apiStudio(req, "b");
  expect(mocks.consume.mock.calls.map(c => c[0])).toEqual([counterKey("api-write", "user-1"), counterKey("api-write", "user-1")]);
  mocks.session.mockResolvedValue({ user: { id: "user-2" } });
  await apiStudio(req, "a");
  expect(mocks.consume.mock.calls[2]![0]).toBe(counterKey("api-write", "user-2"));
});

it("leaves reads, including public portal reads, outside the write limit", async () => {
  for (const path of ["/api/studios/a/orders", "/p/token"]) {
    await apiStudio(new Request(`http://localhost${path}`), "a");
  }
  expect(mocks.consume).not.toHaveBeenCalled();
});

it("returns a generic 429 with Retry-After and denies writes on a storage failure", async () => {
  const req = new Request("http://localhost/api/studios/a/orders", { method: "PATCH" });
  mocks.consume.mockResolvedValue({ allowed: false, retryAfter: 12 });
  const response = await apiStudio(req, "a").then(() => { throw new Error("expected rejection"); }, apiError);
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("12");
  expect(await response.json()).toEqual({ error: "Spróbuj ponownie później." });
  mocks.consume.mockRejectedValue(new Error("private Redis address"));
  const failure = await apiStudio(req, "a").then(() => { throw new Error("expected rejection"); }, apiError);
  expect(failure.status).toBe(503);
  expect(await failure.text()).not.toContain("Redis");
});

it("checks authorization before consuming a user's quota", async () => {
  mocks.authorize.mockRejectedValue(new Error("forbidden"));
  await expect(apiStudio(new Request("http://localhost/api/studios/b/orders", { method: "DELETE" }), "b")).rejects.toThrow("forbidden");
  expect(mocks.consume).not.toHaveBeenCalled();
});
