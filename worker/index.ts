import { platformDb } from "../lib/db/client";
import { logger } from "../src/observability/logger";
import { captureWorkerError, initSentry } from "../src/observability/sentry";
import { deliverQuoteDecisionMails } from "../src/server/portal/mail";
import { deliverQuoteMails } from "../src/server/wyceny/mail";
import { ksefQueue } from "../src/ksef/queue";
import { startBillingWorker } from "../src/worker/billing";
import { recoverKsefOutbox, startKsefWorker } from "../src/worker/ksef";

initSentry("worker");
const log = logger.child({ service: "worker" });

const ksefWorker = startKsefWorker();
const billingWorker = await startBillingWorker();

log.info("worker started");
let current: Promise<void> | undefined;
function tick() {
  if (current) return;
  current = Promise.all([deliverQuoteDecisionMails(), deliverQuoteMails(), recoverKsefOutbox()]).then(() => undefined)
    .catch(error => {
      log.error("worker outbox failed");
      void captureWorkerError(error, { queue: "outbox" });
    })
    .finally(() => { current = undefined; });
}
tick();
const timer = setInterval(tick, 15_000);
async function shutdown(signal: string) {
  log.info({ signal }, "worker stopping");
  clearInterval(timer);
  await current;
  await billingWorker.close();
  await ksefWorker.close();
  await ksefQueue().close();
  await platformDb.$disconnect();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
