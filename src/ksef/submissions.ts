import type { KsefEnv } from "../../lib/db/generated/client";
import { platformDb } from "../../lib/db/client";
import { studioDb } from "../../lib/db/tenant";
import { AccessError } from "../server/acl";
import { assertKsefProduction, assertKsefTest, type KsefEnvironment } from "./config";
import { ksefProdEnabled } from "./flag";
import { hash } from "./client";
import { decryptToken, encryptTestToken, encryptToken, tokenEnvironment } from "./secrets";
import { enqueueKsef, assertKsefRetryIdle } from "./queue";

/** Server-only API for #43. No HTTP endpoint accepts caller-supplied XML or validation flags. */
export type PrepareInvoiceXml = (studioId: string, invoiceId: string) => Promise<{
  xml: string;
  validateXsd: () => Promise<void>;
}>;

const ENV_MISMATCH = "Token KSeF nie pasuje do środowiska studia.";

function asEnvironment(env: KsefEnv): KsefEnvironment {
  return env;
}

export async function ksefStudioStatus(studioId: string) {
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { ksefEnv: true, ksefTokenEnc: true } });
  if (!studio) throw new AccessError(404, "Nie znaleziono studia.");
  return { env: studio.ksefEnv, tokenSet: Boolean(studio.ksefTokenEnc), prodAllowed: await ksefProdEnabled() };
}

/** Zmiana środowiska kasuje szyfrogram. Token TEST nie zostaje przy env PROD. */
export async function setStudioKsefEnv(studioId: string, env: KsefEnvironment, actorId?: string) {
  if (env === "production") {
    if (!await ksefProdEnabled()) throw new AccessError(409, "KSeF PROD jest wyłączony.");
    assertKsefProduction();
  } else assertKsefTest();
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { ksefEnv: true } });
  if (!studio) throw new AccessError(404, "Nie znaleziono studia.");
  if (studio.ksefEnv === env) return;
  const updated = await platformDb.studio.updateMany({
    where: { id: studioId, ksefEnv: studio.ksefEnv },
    data: { ksefEnv: env, ksefTokenEnc: null },
  });
  if (!updated.count) throw new AccessError(409, "Środowisko KSeF studia zmieniło się w trakcie zapisu.");
  await platformDb.auditLog.create({ data: { studioId, actorId: actorId ?? null, action: "studio.ksef.env", meta: { env } } });
}

export async function saveTestToken(studioId: string, token: string) {
  assertKsefTest();
  const encrypted = encryptTestToken(studioId, token);
  const result = await platformDb.studio.updateMany({ where: { id: studioId, ksefEnv: "test" }, data: { ksefTokenEnc: encrypted } });
  if (!result.count) throw new AccessError(409, "Studio musi korzystać z KSeF TEST.");
}

/** Szyfruje token kluczem środowiska zapisanego na studiu. Body nie wybiera TEST ani PROD. */
export async function saveKsefToken(studioId: string, token: string) {
  const studio = await platformDb.studio.findUnique({ where: { id: studioId }, select: { ksefEnv: true } });
  if (!studio) throw new AccessError(404, "Nie znaleziono studia.");
  const env = asEnvironment(studio.ksefEnv);
  if (env === "production") {
    if (!await ksefProdEnabled()) throw new AccessError(409, "KSeF PROD jest wyłączony.");
    assertKsefProduction();
  } else assertKsefTest();
  let encrypted: string;
  try { encrypted = encryptToken(studioId, env, token); }
  catch { throw new AccessError(409, "Nie można zapisać tokenu KSeF. Sprawdź konfigurację środowiska."); }
  const result = await platformDb.studio.updateMany({ where: { id: studioId, ksefEnv: env }, data: { ksefTokenEnc: encrypted } });
  if (!result.count) throw new AccessError(409, "Środowisko KSeF studia zmieniło się w trakcie zapisu.");
}

async function assertTokenMatches(studioId: string, env: KsefEnvironment, encrypted: string) {
  if (tokenEnvironment(encrypted) !== env) throw new AccessError(409, ENV_MISMATCH);
  try { decryptToken(studioId, env, encrypted); }
  catch { throw new AccessError(409, ENV_MISMATCH); }
}

async function queueForEnv(studioId: string, invoiceId: string, env: KsefEnvironment, prepare: PrepareInvoiceXml) {
  const label = env === "production" ? "PROD" : "TEST";
  if (env === "production") {
    if (!await ksefProdEnabled()) throw new AccessError(409, "KSeF PROD jest wyłączony.");
    assertKsefProduction();
  } else assertKsefTest();
  const db = studioDb(studioId);
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, studioId }, include: { workOrder: true, submission: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  if (invoice.ksefEnv !== env || invoice.status !== "issued" || invoice.workOrder.status !== "completed" || !invoice.workOrder.completedAt) {
    throw new AccessError(409, env === "test"
      ? "Wysyłka wymaga wystawionej faktury TEST po zakończeniu zlecenia."
      : "Wysyłka wymaga wystawionej faktury PROD po zakończeniu zlecenia.");
  }
  if (invoice.submission || invoice.ksefStatus !== "not_sent") throw new AccessError(409, "Faktura była już skierowana do KSeF.");
  const studio = await platformDb.studio.findFirst({ where: { id: studioId, ksefEnv: env }, select: { ksefTokenEnc: true, nip: true } });
  if (!studio?.ksefTokenEnc || !studio.nip) throw new AccessError(409, `Skonfiguruj NIP i token KSeF ${label} studia.`);
  await assertTokenMatches(studioId, env, studio.ksefTokenEnc);
  const prepared = await prepare(studioId, invoiceId);
  await prepared.validateXsd();
  if (!prepared.xml || Buffer.byteLength(prepared.xml) > 1_000_000) throw new AccessError(400, "Nieprawidłowy rozmiar XML.");
  await db.$transaction(async scoped => {
    const claimed = await scoped.invoice.updateMany({ where: { id: invoiceId, studioId, ksefEnv: env, status: "issued", ksefStatus: "not_sent" }, data: { ksefStatus: "queued" } });
    if (claimed.count !== 1) throw new AccessError(409, "Faktura była już skierowana do KSeF.");
    await scoped.ksefSubmission.create({ data: { studioId, invoiceId, xml: prepared.xml, xmlHash: hash(Buffer.from(prepared.xml)) } });
    await scoped.ksefEvent.create({ data: { studioId, invoiceId, kind: "validated", at: new Date(), message: `Walidacja XSD FA(3) OK · KSeF ${label}` } });
  });
  await enqueueKsef({ studioId, invoiceId });
}

/** Immutable snapshot + event are committed before Redis; the outbox sweep repairs a failed enqueue. */
export async function queueTestInvoice(studioId: string, invoiceId: string, prepare: PrepareInvoiceXml) {
  await queueForEnv(studioId, invoiceId, "test", prepare);
}

/** Środowisko bierze z faktury i studia, nigdy z argumentu wywołującego. */
export async function queueKsefInvoice(studioId: string, invoiceId: string, prepare: PrepareInvoiceXml) {
  const invoice = await studioDb(studioId).invoice.findFirst({ where: { id: invoiceId, studioId }, select: { ksefEnv: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  await queueForEnv(studioId, invoiceId, asEnvironment(invoice.ksefEnv), prepare);
}

/** Retry preserves ambiguous submissions; only confirmed rejections may get a new XML. */
export async function retryKsefInvoice(studioId: string, invoiceId: string, buyerNip?: string) {
  const db = studioDb(studioId);
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId }, include: { submission: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  if (invoice.status !== "issued" || invoice.ksefNumber || !["rejected", "retrying"].includes(invoice.ksefStatus)) {
    throw new AccessError(409, "Nie można ponowić tej faktury. Zaakceptowana faktura wymaga korekty.");
  }
  const env = asEnvironment(invoice.ksefEnv);
  if (env === "production") {
    if (!await ksefProdEnabled()) throw new AccessError(409, "KSeF PROD jest wyłączony.");
    assertKsefProduction();
  } else assertKsefTest();
  const studio = await platformDb.studio.findFirst({ where: { id: studioId, ksefEnv: env }, select: { ksefTokenEnc: true, nip: true } });
  if (!studio?.ksefTokenEnc || !studio.nip) throw new AccessError(409, "Skonfiguruj NIP i token KSeF studia.");
  await assertTokenMatches(studioId, env, studio.ksefTokenEnc);
  await assertKsefRetryIdle({ studioId, invoiceId });
  await db.$transaction(async tx => {
    const current = await tx.invoice.findFirst({ where: { id: invoiceId }, include: { submission: true, workOrder: true } });
    if (!current || current.ksefStatus !== invoice.ksefStatus || current.ksefNumber || current.status !== "issued" || current.workOrder.status !== "completed" || !current.workOrder.completedAt) throw new AccessError(409, "Stan faktury zmienił się. Odśwież stronę.");
    const submission = current.submission;
    if (!submission) throw new AccessError(409, "Brak zapisu poprzedniej wysyłki. Wymagana weryfikacja operatora.");
    const replace = current.ksefStatus === "rejected";
    if (replace && submission.sendStartedAt) {
      const rejection = await tx.ksefEvent.findFirst({ where: { invoiceId, kind: "rejected" }, orderBy: { at: "desc" } });
      // A lost response is never proof that MF rejected a document.
      if (!submission.invoiceReference || !/odrzucono fakturę \(4(?!29)\d{2}\)/.test(rejection?.message ?? "")) throw new AccessError(409, "Niepotwierdzony wynik wysyłki. Wymagana weryfikacja operatora.");
    }
    if (buyerNip !== undefined && !replace) throw new AccessError(409, "Przed zmianą NIP trzeba potwierdzić odrzucenie dokumentu.");
    const claimed = await tx.invoice.updateMany({ where: { id: invoiceId, ksefStatus: current.ksefStatus, ksefNumber: null }, data: { ksefStatus: "queued", ...(buyerNip !== undefined ? { buyerNip } : {}) } });
    if (claimed.count !== 1) throw new AccessError(409, "Stan faktury zmienił się. Odśwież stronę.");
    if (replace) {
      const { invoiceDocument } = await import("../server/faktury/document");
      const { generateFa3 } = await import("./fa3");
      const { validateFa3Xsd } = await import("./validate");
      const xml = generateFa3(await invoiceDocument(studioId, invoiceId, env, tx));
      await validateFa3Xsd(xml);
      await tx.ksefSubmission.update({ where: { id: submission.id }, data: { xml, xmlHash: hash(Buffer.from(xml)), sessionReference: null, invoiceReference: null, sendStartedAt: null } });
    }
    await tx.ksefEvent.create({ data: { studioId, invoiceId, kind: "validated", at: new Date(), message: replace ? "Zweryfikowano XML FA(3) przed ponowieniem" : "Ponowiono sprawdzenie poprzedniej wysyłki KSeF" } });
  });
  await enqueueKsef({ studioId, invoiceId });
}
