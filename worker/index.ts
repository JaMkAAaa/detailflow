import { platformDb } from "../lib/db/client";
import { deliverQuoteDecisionMails } from "../src/server/portal/mail";
import { deliverQuoteMails } from "../src/server/wyceny/mail";
import { recoverKsefOutbox, startKsefWorker } from "../src/worker/ksef";
import { ksefQueue } from "../src/ksef/queue";

const ksefWorker = startKsefWorker();

console.log("[worker] started");
let current: Promise<void> | undefined;
function tick() {
  if (current) return;
  current = Promise.all([deliverQuoteDecisionMails(), deliverQuoteMails(), recoverKsefOutbox()]).then(() => undefined)
    .catch(() => console.error("[worker] outbox failed"))
    .finally(() => { current = undefined; });
}
tick();
const timer = setInterval(tick, 15_000);
async function shutdown(signal: string) {
  console.log(`[worker] ${signal}, stopping`);
  clearInterval(timer);
  await current;
  await ksefWorker.close();
  await ksefQueue().close();
  await platformDb.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
