export type BackupConfig = {
  databaseUrl: string;
  retentionDays: number;
  prefix: string;
  hourUtc: number;
  s3: { endpoint: string; region: string; bucket: string; accessKey: string; secretKey: string };
};

export function readBackupConfig(env: Record<string, string | undefined> = process.env): BackupConfig {
  const required = ["DATABASE_URL", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"] as const;
  const missing = required.filter(key => !env[key]);
  if (missing.length) throw new Error(`backup configuration missing: ${missing.join(", ")}`);
  const retentionDays = Number(env.BACKUP_RETENTION_DAYS ?? 14);
  const hourUtc = Number(env.BACKUP_HOUR_UTC ?? 3);
  const prefix = (env.BACKUP_S3_PREFIX ?? "backups/postgres").replace(/^\/+|\/+$/g, "");
  if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 3650) throw new Error("BACKUP_RETENTION_DAYS is invalid");
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) throw new Error("BACKUP_HOUR_UTC is invalid");
  if (!prefix || prefix.split("/").includes("..")) throw new Error("BACKUP_S3_PREFIX is invalid");
  return {
    databaseUrl: env.DATABASE_URL ?? "",
    retentionDays,
    prefix,
    hourUtc,
    s3: {
      endpoint: env.S3_ENDPOINT ?? "",
      region: env.S3_REGION || "us-east-1",
      bucket: env.S3_BUCKET ?? "",
      accessKey: env.S3_ACCESS_KEY ?? "",
      secretKey: env.S3_SECRET_KEY ?? "",
    },
  };
}
