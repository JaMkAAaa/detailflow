import { expect, it } from "vitest";
import { expiredBackupKeys } from "./retention";

const day = (offset: number) => new Date(Date.UTC(2026, 9, 28 - offset, 3, 0, 0));

it("drops dumps older than the retention window and keeps the newest one", () => {
  const objects = [
    { key: "backups/postgres/old.dump", lastModified: day(30) },
    { key: "backups/postgres/older.dump", lastModified: day(40) },
    { key: "backups/postgres/fresh.dump", lastModified: day(1) },
    { key: "backups/postgres/today.dump", lastModified: day(0) },
  ];
  expect(expiredBackupKeys(objects, day(0), 14, "backups/postgres/today.dump").sort()).toEqual([
    "backups/postgres/old.dump",
    "backups/postgres/older.dump",
  ]);
  expect(expiredBackupKeys([{ key: "only.dump", lastModified: day(40) }], day(0), 14)).toEqual([]);
});
