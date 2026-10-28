import { expect, it } from "vitest";
import { runBackup, type BackupStore } from "./run";

it("stores a custom dump and deletes expired objects", async () => {
  const objects: { key: string; lastModified: Date; body?: Buffer }[] = [
    { key: "backups/postgres/old.dump", lastModified: new Date("2026-09-01T03:00:00.000Z") },
  ];
  const store: BackupStore = {
    async put(key, body) {
      objects.push({ key, lastModified: new Date("2026-10-28T03:00:00.000Z"), body });
    },
    async list() {
      return objects.map(({ key, lastModified }) => ({ key, lastModified }));
    },
    async delete(keys) {
      for (const key of keys) {
        const index = objects.findIndex(object => object.key === key);
        if (index >= 0) objects.splice(index, 1);
      }
    },
  };
  const result = await runBackup({
    now: new Date("2026-10-28T03:00:00.000Z"),
    retentionDays: 14,
    prefix: "backups/postgres",
    dump: async () => Buffer.from("PGDMParchive"),
    store,
  });
  expect(result.key).toBe("backups/postgres/detailflow-20261028T030000Z.dump");
  expect(result.deleted).toEqual(["backups/postgres/old.dump"]);
  expect(objects.map(object => object.key)).toEqual([result.key]);
  await expect(runBackup({
    now: new Date(),
    retentionDays: 14,
    prefix: "backups/postgres",
    dump: async () => Buffer.from("not-a-dump"),
    store,
  })).rejects.toThrow("custom-format");
});
