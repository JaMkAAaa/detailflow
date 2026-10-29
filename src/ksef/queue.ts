import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { AccessError } from "../server/acl";
import { assertKsefTest } from "./config";

export const KSEF_QUEUE = "ksef-test";
export const KSEF_ATTEMPTS = 10;
export type KsefJob = { studioId: string; invoiceId: string };
export function ksefJobId(job: KsefJob) {
  return createHash("sha256").update(JSON.stringify([job.studioId, job.invoiceId])).digest("hex");
}
export function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("Redis URL required");
  return { host: url.hostname, port: Number(url.port || 6379), username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined, db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}), maxRetriesPerRequest: null };
}
let queue: Queue<KsefJob> | undefined;
export function ksefQueue() {
  assertKsefTest();
  return queue ??= new Queue<KsefJob>(KSEF_QUEUE, { connection: { ...redisConnection(), maxRetriesPerRequest: 1 },
    defaultJobOptions: { attempts: KSEF_ATTEMPTS, backoff: { type: "ksef" }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } } });
}
export async function enqueueKsef(job: KsefJob) {
  const queue = ksefQueue();
  const previous = await queue.getJob(ksefJobId(job));
  if (previous && ["failed", "completed"].includes(await previous.getState())) await previous.remove();
  return queue.add("send", job, { jobId: ksefJobId(job) });
}

/** Never change a snapshot while a worker can still use it. */
export async function assertKsefRetryIdle(job: KsefJob) {
  const previous = await ksefQueue().getJob(ksefJobId(job));
  if (previous && !["failed", "completed"].includes(await previous.getState())) {
    throw new AccessError(409, "Wysyłka jest w toku lub czeka na automatyczne ponowienie.");
  }
}
