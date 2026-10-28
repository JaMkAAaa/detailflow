import { expect, it } from "vitest";
import { healthReport } from "./health";

const ok = async () => undefined;
const fail = async () => {
  throw new Error("postgresql://detailflow:secret@postgres:5432/detailflow");
};

it("reports ok only when database and redis both answer", async () => {
  const now = new Date("2026-10-28T12:00:00.000Z");
  await expect(healthReport({ checkDb: ok, checkRedis: ok, now })).resolves.toEqual({
    status: "ok",
    time: "2026-10-28T12:00:00.000Z",
    checks: { db: "ok", redis: "ok" },
  });
  const down = await healthReport({ checkDb: fail, checkRedis: ok, now });
  expect(down.status).toBe("error");
  expect(down.checks).toEqual({ db: "error", redis: "ok" });
  expect(JSON.stringify(down)).not.toContain("secret");
  const redisDown = await healthReport({ checkDb: ok, checkRedis: fail, now });
  expect(redisDown.checks.redis).toBe("error");
});
