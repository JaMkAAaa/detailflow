import { Redis } from "ioredis";
import { Queue, Worker } from "bullmq";
import { platformDb } from "../lib/db/client";
import { relayQuoteEmails } from "../src/server/wyceny/outbox";
import { deliverQuoteEmail, type QuoteEmailJob } from "../src/server/wyceny/email";

if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required");
const queueRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
const workerRedis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue<QuoteEmailJob>("quote-email", { connection: queueRedis });
const worker = new Worker<QuoteEmailJob>("quote-email", (job) => deliverQuoteEmail(job.data), { connection: workerRedis, concurrency: 5 });
worker.on("error", (error) => console.error("[quote-email] worker error", error.message));
queue.on("error", (error) => console.error("[quote-email] queue error", error.message));
worker.on("failed", (job, error) => console.error("[quote-email] delivery failed", job?.id, error.message));

let relaying = false;
let relayTask: Promise<void> | undefined;
async function relay() {
  if (relaying) return;
  relaying = true;
  try {
    await relayQuoteEmails(({ studioId, emailId }) => queue.add("send", { studioId, emailId }, { jobId: emailId, attempts: 2147483647, backoff: { type: "fixed", delay: 30000 }, removeOnComplete: { age: 86400 }, removeOnFail: false }));
  } catch (error) { console.error("[quote-email] outbox relay failed", error instanceof Error ? error.message : "unknown"); }
  finally { relaying = false; }
}
const timer = setInterval(() => { if (!relaying) relayTask = relay(); }, 5000);
relayTask = relay();
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  await relayTask;
  await worker.close();
  await queue.close();
  await Promise.all([queueRedis.quit(), workerRedis.quit()]);
  await platformDb.$disconnect();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
