import { runBackupCron, runBackupOnce } from "../src/backup/cron";
import { logger } from "../src/observability/logger";

if (process.argv.includes("--cron")) {
  await runBackupCron();
} else {
  const result = await runBackupOnce();
  logger.info({ key: result.key, bytes: result.bytes, deleted: result.deleted.length }, "postgres backup completed");
}
