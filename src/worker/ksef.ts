import { Worker, UnrecoverableError, type Job } from "bullmq";
import { platformDb } from "../../lib/db/client";
import { studioDb } from "../../lib/db/tenant";
import type { KsefEventKind } from "../../lib/db/generated/client";
import { KsefClient, KsefError } from "../ksef/client";
import { assertKsefTest } from "../ksef/config";
import { decryptTestToken } from "../ksef/secrets";
import { enqueueKsef, KSEF_ATTEMPTS, KSEF_QUEUE, redisConnection, type KsefJob } from "../ksef/queue";

export async function processKsef(job: Pick<Job<KsefJob>, "data" | "attemptsMade" | "opts">, client = new KsefClient()) {
  assertKsefTest();
  const { studioId, invoiceId } = job.data;
  const db = studioDb(studioId);
  const attempt = job.attemptsMade + 1;
  const invoice = await db.invoice.findFirst({ where: { studioId, id: invoiceId }, include: { submission: true } });
  if (!invoice?.submission) throw new UnrecoverableError("KSeF TEST: invoice submission not found");
  if (invoice.ksefEnv !== "test" || invoice.status !== "issued") throw new UnrecoverableError("KSeF TEST: invoice is not eligible");
  if (invoice.ksefStatus === "rejected" || (invoice.ksefStatus === "accepted" && invoice.ksefUpoXml)) return;
  const submission = invoice.submission;
  const event = async (kind: KsefEventKind, message: string, ref?: string) => {
    await db.ksefEvent.create({ data: { studioId, invoiceId, kind, at: new Date(), attempt, message, ref } });
  };
  try {
    const studio = await platformDb.studio.findFirst({ where: { id: studioId, ksefEnv: "test" }, select: { nip: true, ksefTokenEnc: true } });
    if (!studio?.nip || !studio.ksefTokenEnc) throw new KsefError("KSeF TEST: studio credentials unavailable");
    let studioToken: string;
    try { studioToken = decryptTestToken(studioId, studio.ksefTokenEnc); }
    catch { throw new KsefError("KSeF TEST: studio token cannot be decrypted; check configuration"); }
    const token = await client.authenticate(studio.nip, studioToken);
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: invoice.ksefNumber ? "accepted" : "processing" } });
    let sessionRef = submission.sessionReference;
    let invoiceRef = submission.invoiceReference;
    if (!invoiceRef && submission.sendStartedAt) {
      if (!sessionRef) throw new KsefError("KSeF TEST: missing session reference");
      invoiceRef = await client.findInvoice(token, sessionRef, submission.xmlHash);
      if (!invoiceRef) throw new KsefError("KSeF TEST: submit outcome unknown; checking existing session only", true);
      await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { invoiceReference: invoiceRef } });
    }
    if (!invoiceRef) {
      const session = await client.openSession(token);
      sessionRef = session.reference;
      // Commit BEFORE submit. A crash after this point must reconcile, never resubmit.
      const claimed = await db.ksefSubmission.updateMany({ where: { id: submission.id, studioId, sendStartedAt: null }, data: { sessionReference: sessionRef, sendStartedAt: new Date() } });
      if (claimed.count !== 1) throw new KsefError("KSeF TEST: submission already claimed; reconcile on retry", true);
      try { invoiceRef = await client.submit(token, session, submission.xml); }
      catch (error) {
        // An explicit 429 did not accept the invoice. Other lost/5xx outcomes
        // remain ambiguous and must reconcile rather than issuing another POST.
        if (error instanceof KsefError && error.retryable && !error.ambiguous) {
          await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { sendStartedAt: null, sessionReference: null } });
          await client.close(token, sessionRef).catch(() => undefined);
        }
        throw error;
      }
      await db.ksefSubmission.update({ where: { id: submission.id, studioId }, data: { invoiceReference: invoiceRef } });
      await event("sent", "Wysłano do KSeF TEST", sessionRef);
    }
    if (!sessionRef) throw new KsefError("KSeF TEST: missing session reference");
    const result = await client.status(token, sessionRef, invoiceRef);
    if (result.status.code < 200) {
      await event("processing", "Przetwarzanie w KSeF TEST", sessionRef);
      throw new KsefError("KSeF TEST: invoice processing", true);
    }
    if (result.status.code !== 200) {
      // Semantic/XSD/NIP/permission errors are terminal. Do not loop on buyer errors.
      throw new KsefError(`KSeF TEST: odrzucono fakturę (${result.status.code}); sprawdź XML i dane nabywcy, w tym NIP`, result.status.code >= 500);
    }
    if (!result.ksefNumber || !result.acquisitionDate || !Number.isFinite(Date.parse(result.acquisitionDate))) throw new KsefError("KSeF TEST: acceptance data pending", true);
    await db.$transaction(async scoped => {
      const updated = await scoped.invoice.updateMany({ where: { id: invoiceId, studioId, ksefNumber: null }, data: {
        ksefStatus: "accepted", ksefNumber: result.ksefNumber, ksefAcceptedAt: new Date(result.acquisitionDate!),
      } });
      if (updated.count) await scoped.ksefEvent.create({ data: { studioId, invoiceId, kind: "accepted", at: new Date(result.acquisitionDate!), attempt, ref: sessionRef,
        message: `Przyjęta w KSeF TEST, numer ${result.ksefNumber}` } });
    });
    const upo = await client.upo(token, sessionRef, invoiceRef);
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: "accepted", ksefUpoXml: upo } });
    // UPO is already durable. A close failure must not change an accepted invoice.
    await client.close(token, sessionRef).catch(() => undefined);
  } catch (error) {
    // No raw exception messages in BullMQ/logs: DB/crypto/HTTP errors may contain secrets.
    const retryable = !(error instanceof KsefError) || error.retryable;
    const lastAttempt = attempt >= (job.opts.attempts ?? KSEF_ATTEMPTS);
    const accepted = await db.invoice.findFirst({ where: { id: invoiceId, studioId }, select: { ksefNumber: true } });
    await db.invoice.update({ where: { id: invoiceId, studioId }, data: { ksefStatus: accepted?.ksefNumber ? "accepted" : retryable ? "retrying" : "rejected" } });
    if (!retryable) {
      await event("rejected", error instanceof KsefError ? error.message : "Odrzucono wysyłkę KSeF TEST");
      throw new UnrecoverableError("KSeF TEST: terminal error; see invoice history");
    }
    await event("timeout", lastAttempt ? "KSeF TEST: wyczerpano próby. Wymagana weryfikacja statusu przez operatora." : "KSeF TEST: oczekiwanie lub błąd przejściowy; ponowne sprawdzenie ze backoff.");
    if (!lastAttempt) await event("retry_scheduled", "Zaplanowano ponowne sprawdzenie KSeF TEST");
    throw new KsefError("KSeF TEST: retryable operation", true, false, error instanceof KsefError ? error.retryAfterMs : undefined);
  }
}

/** Platform discovery only; every invoice write/read inside processKsef uses studioDb. */
export async function recoverKsefOutbox() {
  assertKsefTest();
  const invoices = await platformDb.invoice.findMany({ where: { ksefEnv: "test", ksefStatus: "queued", submission: { isNot: null } }, select: { studioId: true, id: true }, take: 100 });
  for (const invoice of invoices) await enqueueKsef({ studioId: invoice.studioId, invoiceId: invoice.id });
}

export function startKsefWorker(client?: KsefClient) {
  assertKsefTest();
  const worker = new Worker<KsefJob>(KSEF_QUEUE, job => processKsef(job, client), {
    connection: redisConnection(), concurrency: 2,
    settings: { backoffStrategy: (attempt, _type, error) => Math.max(Math.min(5000 * 2 ** (attempt - 1), 300_000), error instanceof KsefError ? error.retryAfterMs ?? 0 : 0) },
  });
  worker.on("error", () => console.error("[worker] KSeF TEST queue error"));
  return worker;
}
