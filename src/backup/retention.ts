export type BackupObject = { key: string; lastModified: Date };

export function expiredBackupKeys(objects: BackupObject[], now: Date, retentionDays: number, protectKey?: string) {
  if (!Number.isInteger(retentionDays) || retentionDays < 1) throw new Error("BACKUP_RETENTION_DAYS is invalid");
  const cutoff = now.getTime() - retentionDays * 86_400_000;
  const newest = [...objects].sort((left, right) => right.lastModified.getTime() - left.lastModified.getTime())[0];
  return objects
    .filter(object => object.key !== protectKey && object.key !== newest?.key && object.lastModified.getTime() < cutoff)
    .map(object => object.key);
}
