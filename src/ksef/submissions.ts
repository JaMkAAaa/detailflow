import { platformDb } from "../../lib/db/client";
import { studioDb } from "../../lib/db/tenant";
import { AccessError } from "../server/acl";
import { assertKsefTest } from "./config";
import { hash } from "./client";
import { encryptTestToken } from "./secrets";
import { enqueueKsef } from "./queue";

/** Server-only API for #43. No HTTP endpoint accepts caller-supplied XML or validation flags. */
export type PrepareInvoiceXml = (studioId: string, invoiceId: string) => Promise<{
  xml: string;
  validateXsd: () => Promise<void>;
}>;

export async function saveTestToken(studioId: string, token: string) {
  assertKsefTest();
  const encrypted = encryptTestToken(studioId, token);
  const result = await platformDb.studio.updateMany({ where: { id: studioId, ksefEnv: "test" }, data: { ksefTokenEnc: encrypted } });
  if (!result.count) throw new AccessError(409, "Studio musi korzystać z KSeF TEST.");
}

/** Immutable snapshot + event are committed before Redis; the outbox sweep repairs a failed enqueue. */
export async function queueTestInvoice(studioId: string, invoiceId: string, prepare: PrepareInvoiceXml) {
  assertKsefTest();
  const db = studioDb(studioId);
  const invoice = await db.invoice.findFirst({ where: { id: invoiceId, studioId }, include: { workOrder: true, submission: true } });
  if (!invoice) throw new AccessError(404, "Nie znaleziono faktury.");
  if (invoice.ksefEnv !== "test" || invoice.status !== "issued" || invoice.workOrder.status !== "completed" || !invoice.workOrder.completedAt) {
    throw new AccessError(409, "Wysyłka wymaga wystawionej faktury TEST po zakończeniu zlecenia.");
  }
  if (invoice.submission || invoice.ksefStatus !== "not_sent") throw new AccessError(409, "Faktura była już skierowana do KSeF.");
  const studio = await platformDb.studio.findFirst({ where: { id: studioId, ksefEnv: "test" }, select: { ksefTokenEnc: true, nip: true } });
  if (!studio?.ksefTokenEnc || !studio.nip) throw new AccessError(409, "Skonfiguruj NIP i token KSeF TEST studia.");
  const prepared = await prepare(studioId, invoiceId);
  await prepared.validateXsd();
  if (!prepared.xml || Buffer.byteLength(prepared.xml) > 1_000_000) throw new AccessError(400, "Nieprawidłowy rozmiar XML.");
  await db.$transaction(async scoped => {
    const claimed = await scoped.invoice.updateMany({ where: { id: invoiceId, studioId, ksefEnv: "test", status: "issued", ksefStatus: "not_sent" }, data: { ksefStatus: "queued" } });
    if (claimed.count !== 1) throw new AccessError(409, "Faktura była już skierowana do KSeF.");
    await scoped.ksefSubmission.create({ data: { studioId, invoiceId, xml: prepared.xml, xmlHash: hash(Buffer.from(prepared.xml)) } });
    await scoped.ksefEvent.create({ data: { studioId, invoiceId, kind: "validated", at: new Date(), message: "Walidacja XSD FA(3) OK · KSeF TEST" } });
  });
  await enqueueKsef({ studioId, invoiceId });
}
