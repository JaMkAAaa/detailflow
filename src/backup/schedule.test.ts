import { expect, it } from "vitest";
import { nextBackupAt } from "./schedule";

it("schedules the next 03:00 UTC run", () => {
  expect(nextBackupAt(new Date("2026-10-28T02:00:00.000Z"), 3).toISOString()).toBe("2026-10-28T03:00:00.000Z");
  expect(nextBackupAt(new Date("2026-10-28T03:00:00.000Z"), 3).toISOString()).toBe("2026-10-29T03:00:00.000Z");
  expect(nextBackupAt(new Date("2026-10-28T04:15:00.000Z"), 3).toISOString()).toBe("2026-10-29T03:00:00.000Z");
});
