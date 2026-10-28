import { Worker, UnrecoverableError, type Job } from "bullmq";
import { platformDb } from "../../lib/db/client";
import { logger } from "../observability/logger";
import { reportWorkerError } from "../observability/report";
import { studioDb } from "../../lib/db/tenant";
import type { KsefEventKind } from "../../lib/db/generated/client";
import { KsefClient, KsefError } from "../ksef/client";
import { assertKsefTest, type KsefEnvironment } from "../ksef/config";
import { ksefProdEnabled } from "../ksef/flag";
import { decryptToken, tokenEnvironment } from "../ksef/secrets";
import { enqueueKsef, KSEF_ATTEMPTS, KSEF_QUEUE, redisConnection, type KsefJob } from "../ksef/queue";

export async function processKsef(job: Pick<Job<KsefJob>, "data" | "attemptsMade" | "opts">, client?: KsefClient) {
  const { studioId, invoiceId } = job.data;
  const db = studioDb(studioId);
  const attempt = job.attemptsMade + 1;
  const invoice = await db.invoice.findFirst({ where: { studioId, id: invoiceId }, include: { submission: true } });
  if (!invoice?.submission) throw new UnrecoverableError("KSeF: invoice submission not found");
  const env: KsefEnvironment = invoice.ksefEnv === "production" ? "production" : "test";
  const label = env === "production" ? "PROD" : "TEST";
  if (env === "test") assertKsefTest();
  if (invoice.status !== "issued") throw new UnrecoverableError(`KSeF ${label}: invoice is not eligible`);
  if (invoice.ksefStatus === "rejected" || (invoice.ksefStatus === "accepted" && invoice.ksefUpoXml)) return;
  const submission = invoice.submission;
  const event = async (kind: KsefEventKind, message: string, ref?: string) => {
    await db.ksefEvent.create({ data: { studioId, invoiceId, kind, at: new Date(), attempt, message, ref } });
  };
  try {
    if (env === "production" && !await ksefProdEnabled()) throw new KsefError("KSeF PROD: flaga wyłączona", true);
    const studio = await platformDb.studio.findFirst({ where: { id: studioId, ksefEnv: env }, select: { nip: true, ksefTokenEnc: true } });
    if (!studio?.nip || !studio.ksefTokenEnc) throw new KsefError(`KSeF ${label}: studio credentials unavailable`);
    if (tokenEnvironment(studio.ksefTokenEnc) !== env) throw new KsefError(`KSeF ${label}: token nie należy do tego środowiska`);
    let studioToken: string;
    try { studioToken = decryptToken(studioId, env, studio.ksefTokenEnc); }
    catch { throw new KsefError(`KSeF ${label}: studio token cannot be decrypted; check configuration`); }
    const api = client ?? new KsefClient(fetch, (ms) => new Promise((resolve) => setTimeout(resolve, ms)), env);
    const token = await api.authenticate(studio.nip, studioToken);
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: invoice.ksefNumber ? "accepted" : "processing" } });
    let sessionRef = submission.sessionReference;
    let invoiceRef = submission.invoiceReference;
    if (!invoiceRef && submission.sendStartedAt) {
      if (!sessionRef) throw new KsefError(`KSeF ${label}: missing session reference`);
      invoiceRef = await api.findInvoice(token, sessionRef, submission.xmlHash);
      if (!invoiceRef) throw new KsefError(`KSeF ${label}: submit outcome unknown; checking existing session only`, true);
      await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { invoiceReference: invoiceRef } });
    }
    if (!invoiceRef) {
      const session = await api.openSession(token);
      sessionRef = session.reference;
      // Commit BEFORE submit. A crash after this point must reconcile, never resubmit.
      const claimed = await db.ksefSubmission.updateMany({ where: { id: submission.id, studioId, sendStartedAt: null }, data: { sessionReference: sessionRef, sendStartedAt: new Date() } });
      if (claimed.count !== 1) throw new KsefError(`KSeF ${label}: submission already claimed; reconcile on retry`, true);
      try { invoiceRef = await api.submit(token, session, submission.xml); }
      catch (error) {
        // An explicit 429 did not accept the invoice. Other lost/5xx outcomes
        // remain ambiguous and must reconcile rather than issuing another POST.
        if (error instanceof KsefError && error.retryable && !error.ambiguous) {
          await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { sendStartedAt: null, sessionReference: null } });
          await api.close(token, sessionRef).catch(() => undefined);
        }
        throw error;
      }
      await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { invoiceReference: invoiceRef } });
      await event("sent", `Wysłano do KSeF ${label}`, sessionRef);
    }
    if (!sessionRef) throw new KsefError(`KSeF ${label}: missing session reference`);
    const result = await api.status(token, sessionRef, invoiceRef);
    if (result.status.code < 200) {
      await event("processing", `Przetwarzanie w KSeF ${label}`, sessionRef);
      throw new KsefError(`KSeF ${label}: invoice processing`, true);
    }
    if (result.status.code !== 200) {
      // Semantic/XSD/NIP/permission errors are terminal. Do not loop on buyer errors.
      throw new KsefError(`KSeF ${label}: odrzucono fakturę (${result.status.code}); sprawdź XML i dane nabywcy, w tym NIP`, result.status.code >= 500);
    }
    if (!result.ksefNumber || !result.acquisitionDate || !Number.isFinite(Date.parse(result.acquisitionDate))) throw new KsefError(`KSeF ${label}: acceptance data pending`, true);
    await db.$transaction(async scoped => {
      const updated = await scoped.invoice.updateMany({ where: { id: invoiceId, studioId, ksefNumber: null }, data: {
        ksefStatus: "accepted", ksefNumber: result.ksefNumber, ksefAcceptedAt: new Date(result.acquisitionDate!),
      } });
      if (updated.count) await scoped.ksefEvent.create({ data: { studioId, invoiceId, kind: "accepted", at: new Date(result.acquisitionDate!), attempt, ref: sessionRef,
        message: `Przyjęta w KSeF ${label}, numer ${result.ksefNumber}` } });
    });
    const upo = await api.upo(token, sessionRef, invoiceRef);
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: "accepted", ksefUpoXml: upo } });
    // UPO is already durable. A close failure must not change an accepted invoice.
    await api.close(token, sessionRef).catch(() => undefined);
  } catch (error) {
    // No raw exception messages in BullMQ/logs: DB/crypto/HTTP errors may contain secrets.
    const retryable = !(error instanceof KsefError) || error.retryable;
    const lastAttempt = attempt >= (job.opts.attempts ?? KSEF_ATTEMPTS);
    const accepted = await db.invoice.findFirst({ where: { id: invoiceId, studioId }, select: { ksefNumber: true } });
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: accepted?.ksefNumber ? "accepted" : retryable ? "retrying" : "rejected" } });
    if (!retryable) {
      await event("rejected", error instanceof KsefError ? error.message : `Odrzucono wysyłkę KSeF ${label}`);
      throw new UnrecoverableError(`KSeF ${label}: terminal error; see invoice history`);
    }
    await event("timeout", lastAttempt ? `KSeF ${label}: wyczerpano próby. Wymagana weryfikacja statusu przez operatora.` : `KSeF ${label}: oczekiwanie lub błąd przejściowy; ponowne sprawdzenie ze backoff.`);
    if (!lastAttempt) await event("retry_scheduled", `Zaplanowano ponowne sprawdzenie KSeF ${label}`);
    throw new KsefError(`KSeF ${label}: retryable operation`, true, false, error instanceof KsefError ? error.retryAfterMs : undefined);
  }
}

/** Platform discovery only; every invoice write/read inside processKsef uses studioDb. */
export async function recoverKsefOutbox() {
  assertKsefTest();
  const prod = await ksefProdEnabled();
  const invoices = await platformDb.invoice.findMany({
    where: { ksefStatus: "queued", submission: { isNot: null }, ksefEnv: prod ? { in: ["test", "production"] } : "test" },
    select: { studioId: true, id: true },
    take: 100,
  });
  for (const invoice of invoices) await enqueueKsef({ studioId: invoice.studioId, invoiceId: invoice.id });
}

export function startKsefWorker(client?: KsefClient) {
  assertKsefTest();
  const worker = new Worker<KsefJob>(KSEF_QUEUE, job => processKsef(job, client), {
    connection: redisConnection(), concurrency: 2,
    settings: { backoffStrategy: (attempt, _type, error) => Math.max(Math.min(5000 * 2 ** (attempt - 1), 300_000), error instanceof KsefError ? error.retryAfterMs ?? 0 : 0) },
  });
  const log = logger.child({ service: "worker", queue: KSEF_QUEUE });
  // Odszyfrowany token zostaje lokalną zmienną. Do logu i Sentry idzie tylko studioId.
  worker.on("error", () => log.error("KSeF queue error"));
  worker.on("failed", (job, error) => {
    const studioId = job?.data.studioId;
    log.error({ studioId }, "KSeF job failed");
    if (!studioId) return;
    reportWorkerError(error, { studioId, queue: KSEF_QUEUE });
  });
  return worker;
}
