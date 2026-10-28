import { logger } from "../observability/logger";
import { readBackupConfig } from "./config";
import { dumpDatabase } from "./dump";
import { runBackup } from "./run";
import { nextBackupAt } from "./schedule";
import { s3BackupStore } from "./store";

const log = logger.child({ service: "backup" });

export async function runBackupOnce(env: NodeJS.ProcessEnv = process.env) {
  const config = readBackupConfig(env);
  return runBackup({
    now: new Date(),
    retentionDays: config.retentionDays,
    prefix: config.prefix,
    dump: () => dumpDatabase(config.databaseUrl),
    store: s3BackupStore(config.s3),
  });
}

export async function runBackupCron() {
  const { hourUtc } = readBackupConfig();
  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  while (!stopped) {
    const next = nextBackupAt(new Date(), hourUtc);
    log.info({ next: next.toISOString() }, "postgres backup scheduled");
    while (!stopped && Date.now() < next.getTime()) {
      await new Promise(resolve => setTimeout(resolve, Math.min(30_000, next.getTime() - Date.now())));
    }
    if (stopped) break;
    try {
      const result = await runBackupOnce();
      log.info({ key: result.key, bytes: result.bytes, deleted: result.deleted.length }, "postgres backup completed");
    } catch (error) {
      log.error({ message: error instanceof Error ? error.message : "backup failed" }, "postgres backup failed");
    }
  }
}
