import { expiredBackupKeys, type BackupObject } from "./retention";

export type BackupStore = {
  put(key: string, body: Buffer): Promise<void>;
  list(prefix: string): Promise<BackupObject[]>;
  delete(keys: string[]): Promise<void>;
};

const CUSTOM_MAGIC = Buffer.from("PGDMP");

export async function runBackup(input: {
  now: Date;
  retentionDays: number;
  prefix: string;
  dump: () => Promise<Buffer>;
  store: BackupStore;
}) {
  const body = await input.dump();
  if (body.length < CUSTOM_MAGIC.length || !body.subarray(0, CUSTOM_MAGIC.length).equals(CUSTOM_MAGIC)) {
    throw new Error("pg_dump did not return a custom-format archive");
  }
  const stamp = input.now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const key = `${input.prefix}/detailflow-${stamp}.dump`;
  try {
    await input.store.put(key, body);
    const existing = await input.store.list(`${input.prefix}/`);
    const deleted = expiredBackupKeys(existing, input.now, input.retentionDays, key);
    if (deleted.length) await input.store.delete(deleted);
    return { key, bytes: body.length, deleted };
  } catch (error) {
    if (error instanceof Error && error.message === "BACKUP_RETENTION_DAYS is invalid") throw error;
    if (error instanceof Error && error.message.startsWith("pg_dump")) throw error;
    throw new Error("backup upload failed");
  }
}
