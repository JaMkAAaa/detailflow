import { Queue, Worker } from "bullmq";
import { redisConnection } from "../ksef/queue";
import { sendTrialReminders } from "../server/billing/trial";

export async function startBillingWorker() {
  const queue = new Queue("billing-daily", { connection: { ...redisConnection(), maxRetriesPerRequest: 1 },
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 60_000 }, removeOnComplete: { count: 30 }, removeOnFail: { count: 30 } } });
  try {
    await queue.upsertJobScheduler("trial-daily", { pattern: "0 6 * * *", tz: "Europe/Warsaw" }, { name: "trial-reminders" });
    // Catch-up po restarcie; sentAt i lock w bazie deduplikują wiele workerów.
    await queue.add("trial-reminders", {});
    const worker = new Worker("billing-daily", () => sendTrialReminders(), { connection: redisConnection(), concurrency: 1 });
    worker.on("error", () => console.error("[billing] worker error"));
    worker.on("failed", () => console.error("[billing] daily job failed"));
    return { close: async () => { await worker.close(); await queue.close(); } };
  } catch (error) {
    await queue.close();
    throw error;
  }
}
