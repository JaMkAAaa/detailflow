import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/src/observability/db-check", () => ({ checkDatabase: vi.fn() }));
vi.mock("@/src/observability/redis", () => ({ pingRedis: vi.fn() }));

import { GET } from "./route";
import { checkDatabase } from "@/src/observability/db-check";
import { pingRedis } from "@/src/observability/redis";

beforeEach(() => {
  vi.mocked(checkDatabase).mockReset();
  vi.mocked(pingRedis).mockReset();
});

it("returns 200 only when the database and redis answer", async () => {
  vi.mocked(checkDatabase).mockResolvedValue(undefined);
  vi.mocked(pingRedis).mockResolvedValue(undefined);
  const ok = await GET();
  expect(ok.status).toBe(200);
  await expect(ok.json()).resolves.toMatchObject({ status: "ok", checks: { db: "ok", redis: "ok" } });
  expect(ok.headers.get("Cache-Control")).toBe("no-store");

  vi.mocked(checkDatabase).mockRejectedValue(new Error("postgresql://detailflow:secret@postgres/detailflow"));
  const down = await GET();
  expect(down.status).toBe(503);
  const body = await down.json();
  expect(body).toMatchObject({ status: "error", checks: { db: "error", redis: "ok" } });
  expect(JSON.stringify(body)).not.toContain("secret");
});
