export function nextBackupAt(now: Date, hourUtc: number) {
  if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) throw new Error("BACKUP_HOUR_UTC is invalid");
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hourUtc, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
