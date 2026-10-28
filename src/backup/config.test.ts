import { expect, it } from "vitest";
import { readBackupConfig } from "./config";

const env = {
  DATABASE_URL: "postgresql://detailflow:secret@postgres:5432/detailflow",
  S3_ENDPOINT: "http://minio:9000",
  S3_BUCKET: "detailflow",
  S3_ACCESS_KEY: "detailflow",
  S3_SECRET_KEY: "detailflow-dev-secret",
};

it("reads backup defaults without echoing secrets in a missing-key error", () => {
  expect(readBackupConfig(env)).toMatchObject({ retentionDays: 14, prefix: "backups/postgres", hourUtc: 3 });
  expect(() => readBackupConfig({ ...env, DATABASE_URL: undefined, S3_SECRET_KEY: undefined })).toThrow(
    "backup configuration missing: DATABASE_URL, S3_SECRET_KEY",
  );
  expect(() => readBackupConfig({ ...env, BACKUP_RETENTION_DAYS: "0" })).toThrow("BACKUP_RETENTION_DAYS is invalid");
});
