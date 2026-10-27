import { randomUUID } from "node:crypto";
import { QueueEvents } from "bullmq";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { platformDb } from "../../lib/db/client";
import { studioDb } from "../../lib/db/tenant";
import { encryptTestToken } from "../ksef/secrets";
import { KsefClient, KsefError, hash } from "../ksef/client";
import { queueTestInvoice, saveTestToken } from "../ksef/submissions";
import { processKsef, recoverKsefOutbox, startKsefWorker } from "./ksef";
import { ksefQueue, ksefJobId, redisConnection, KSEF_QUEUE } from "../ksef/queue";
import { invoiceAttentionCount } from "../server/faktury/list-query";

vi.mock("../ksef/queue", async importOriginal => ({ ...await importOriginal<typeof import("../ksef/queue")>(), enqueueKsef: vi.fn() }));
import { enqueueKsef } from "../ksef/queue";
const tag = randomUUID();
let a: string, b: string, orderId: string;
const xml = "<Faktura>prepared by #43</Faktura>";
let seq = 0;
beforeAll(async () => {
  vi.stubEnv("KSEF_ENV", "test");
  vi.stubEnv("KSEF_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, name: suffix, nip: "1234567890" } })));
  a = studios[0]!.id; b = studios[1]!.id;
  await saveTestToken(b, "test-studio-token");
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Buyer" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "BMW", model: "X3", plate: tag } });
  const order = await db.workOrder.create({ data: { studioId: b, clientId: client.id, vehicleId: vehicle.id, number: "DF-0243", status: "completed", completedAt: new Date(), service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "4800" } });
  orderId = order.id;
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } });
  vi.unstubAllEnvs();
});
beforeEach(() => vi.clearAllMocks());
async function invoice(env: "test" | "production" = "test") {
  return studioDb(b).invoice.create({ data: { studioId: b, workOrderId: orderId, number: `FV/${++seq}`, status: "issued", issuedAt: new Date("2026-10-24T08:12:08Z"), ksefEnv: env,
    buyerName: "Buyer", buyerNip: "bad-nip", totalNet: "3902.44", totalVat: "897.56", totalGross: "4800" } });
}
const prepare = vi.fn(async () => ({ xml, validateXsd: vi.fn(async () => undefined) }));
function api() {
  return {
    authenticate: vi.fn(async () => "access"),
    openSession: vi.fn(async () => ({ reference: "session", key: Buffer.alloc(32), iv: Buffer.alloc(16) })),
    submit: vi.fn(async () => "document"),
    status: vi.fn(async () => ({ status: { code: 200, description: "OK" }, ksefNumber: `test-number-${seq}`, acquisitionDate: "2026-10-24T08:13:08Z" })),
    upo: vi.fn(async () => "<UPO/>") , close: vi.fn(async () => undefined),
    findInvoice: vi.fn(async (): Promise<string | null> => "document"),
  };
}
const job = (studioId: string, invoiceId: string, attemptsMade = 0) => ({ data: { studioId, invoiceId }, attemptsMade, opts: { attempts: 3 } });

it("isolates submission XML, references, token encryption and history by studio", async () => {
  const inv = await invoice();
  await expect(queueTestInvoice(a, inv.id, prepare)).rejects.toMatchObject({ status: 404 });
  expect(prepare).not.toHaveBeenCalled();
  await queueTestInvoice(b, inv.id, prepare);
  expect(await studioDb(a).ksefSubmission.findMany()).toEqual([]);
  const client = api();
  await expect(processKsef(job(a, inv.id), client as unknown as KsefClient)).rejects.toThrow("not found");
  expect(client.authenticate).not.toHaveBeenCalled();
  expect(await studioDb(a).ksefEvent.findMany()).toEqual([]);
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: b } });
  expect(studio.ksefTokenEnc).not.toContain("test-studio-token");
  expect(encryptTestToken(a, "token")).not.toBe(encryptTestToken(b, "token"));
});
it("validates before queueing, commits one immutable snapshot and recovers a failed Redis enqueue", async () => {
  const inv = await invoice();
  const validateXsd = vi.fn().mockRejectedValue(new Error("XSD failure"));
  await expect(queueTestInvoice(b, inv.id, async () => ({ xml, validateXsd }))).rejects.toThrow("XSD failure");
  expect(await studioDb(b).ksefSubmission.findFirst({ where: { invoiceId: inv.id } })).toBeNull();
  vi.mocked(enqueueKsef).mockRejectedValueOnce(new Error("Redis unavailable"));
  await expect(queueTestInvoice(b, inv.id, prepare)).rejects.toThrow("Redis unavailable");
  const snapshot = await studioDb(b).ksefSubmission.findFirstOrThrow({ where: { invoiceId: inv.id } });
  expect(snapshot).toMatchObject({ xml, xmlHash: hash(Buffer.from(xml)), studioId: b });
  await expect(queueTestInvoice(b, inv.id, prepare)).rejects.toMatchObject({ status: 409 });
  await recoverKsefOutbox();
  expect(enqueueKsef).toHaveBeenCalledWith({ studioId: b, invoiceId: inv.id });
});
it("rejects production invoices before preparing XML", async () => {
  const inv = await invoice("production");
  await expect(queueTestInvoice(b, inv.id, prepare)).rejects.toMatchObject({ status: 409 });
  expect(prepare).not.toHaveBeenCalled();
});
it("persists accepted number, actual acceptance time, UPO and events, then treats replay as a no-op", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  await processKsef(job(b, inv.id), client as unknown as KsefClient);
  await processKsef(job(b, inv.id), client as unknown as KsefClient);
  const saved = await studioDb(b).invoice.findFirstOrThrow({ where: { id: inv.id }, include: { events: true, submission: true } });
  expect(saved.ksefStatus).toBe("accepted");
  expect(saved.ksefNumber).toBe(`test-number-${seq}`);
  expect(saved.ksefUpoXml).toBe("<UPO/>");
  expect((saved.ksefAcceptedAt!.getTime() - saved.issuedAt!.getTime()) / 1000).toBe(60);
  expect(saved.events.map(e => e.kind).sort()).toEqual(["accepted", "sent", "validated"]);
  expect(saved.submission?.invoiceReference).toBe("document");
  expect(client.submit).toHaveBeenCalledTimes(1);
});
it("leaves buyer/NIP rejection in D-10 and never automatically resubmits it", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.status.mockResolvedValue({ status: { code: 450, description: "Nieprawidłowy NIP" }, ksefNumber: "", acquisitionDate: "" });
  await expect(processKsef(job(b, inv.id), client as unknown as KsefClient)).rejects.toThrow("terminal error");
  await processKsef(job(b, inv.id, 1), client as unknown as KsefClient);
  const saved = await studioDb(b).invoice.findFirstOrThrow({ where: { id: inv.id }, include: { events: true } });
  expect(saved.ksefStatus).toBe("rejected");
  expect(saved.events.some(e => e.kind === "retry_scheduled")).toBe(false);
  expect(await invoiceAttentionCount(b, "test")).toBeGreaterThan(0);
  expect(await invoiceAttentionCount(a, "test")).toBe(0);
  expect(client.submit).toHaveBeenCalledTimes(1);
});
it("recovers an ambiguous submit by hash in the existing session without a second POST", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.submit.mockRejectedValueOnce(new KsefError("timeout", true, true));
  await expect(processKsef(job(b, inv.id), client as unknown as KsefClient)).rejects.toMatchObject({ retryable: true });
  await processKsef(job(b, inv.id, 1), client as unknown as KsefClient);
  expect(client.submit).toHaveBeenCalledTimes(1);
  expect(client.openSession).toHaveBeenCalledTimes(1);
  expect(client.findInvoice).toHaveBeenCalledWith("access", "session", hash(Buffer.from(xml)));
});
it("bounds polling, leaves exhausted attempts for operator attention, and never restarts them via outbox", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.status.mockResolvedValue({ status: { code: 150, description: "Pending" }, ksefNumber: "", acquisitionDate: "" });
  for (let attempt = 0; attempt < 3; attempt++) await expect(processKsef(job(b, inv.id, attempt), client as unknown as KsefClient)).rejects.toMatchObject({ retryable: true });
  const saved = await studioDb(b).invoice.findFirstOrThrow({ where: { id: inv.id }, include: { events: true } });
  expect(saved.ksefStatus).toBe("retrying");
  expect(saved.events.filter(e => e.kind === "retry_scheduled")).toHaveLength(2);
  vi.mocked(enqueueKsef).mockClear();
  await recoverKsefOutbox();
  expect(enqueueKsef).not.toHaveBeenCalledWith({ studioId: b, invoiceId: inv.id });
  expect(client.submit).toHaveBeenCalledTimes(1);
});
it("never sends again when an ambiguous submission remains absent from the session", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.submit.mockRejectedValueOnce(new KsefError("timeout", true, true));
  client.findInvoice.mockResolvedValue(null);
  for (let attempt = 0; attempt < 3; attempt++) await expect(processKsef(job(b, inv.id, attempt), client as unknown as KsefClient)).rejects.toMatchObject({ retryable: true });
  expect(client.submit).toHaveBeenCalledTimes(1);
  expect(client.openSession).toHaveBeenCalledTimes(1);
  expect(client.findInvoice).toHaveBeenCalledTimes(2);
  expect((await studioDb(b).invoice.findFirstOrThrow({ where: { id: inv.id } })).ksefStatus).toBe("retrying");
});
it("retries an explicitly rate-limited submit while retaining ambiguous submissions for reconciliation", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.submit.mockRejectedValueOnce(new KsefError("HTTP 429", true, false, 30000));
  await expect(processKsef(job(b, inv.id), client as unknown as KsefClient)).rejects.toMatchObject({ retryAfterMs: 30000 });
  expect((await studioDb(b).ksefSubmission.findFirstOrThrow({ where: { invoiceId: inv.id } })).sendStartedAt).toBeNull();
  await processKsef(job(b, inv.id, 1), client as unknown as KsefClient);
  expect(client.submit).toHaveBeenCalledTimes(2);
  expect(client.findInvoice).not.toHaveBeenCalled();
});
it("retains accepted number when UPO is delayed and fetches UPO again without resubmission", async () => {
  const inv = await invoice();
  await queueTestInvoice(b, inv.id, prepare);
  const client = api();
  client.upo.mockRejectedValueOnce(new KsefError("not ready", true));
  await expect(processKsef(job(b, inv.id), client as unknown as KsefClient)).rejects.toMatchObject({ retryable: true });
  const saved = await studioDb(b).invoice.findFirstOrThrow({ where: { id: inv.id } });
  expect(saved.ksefStatus).toBe("accepted");
  expect(saved.ksefNumber).toBeTruthy();
  expect(saved.ksefUpoXml).toBeNull();
  await processKsef(job(b, inv.id, 1), client as unknown as KsefClient);
  expect(client.submit).toHaveBeenCalledTimes(1);
  expect(client.upo).toHaveBeenCalledTimes(2);
});

it.skipIf(!process.env.KSEF_REDIS_TEST_URL)("runs real BullMQ retries and stops buyer-data failures after one attempt", async () => {
  vi.stubEnv("REDIS_URL", process.env.KSEF_REDIS_TEST_URL!);
  const queue = ksefQueue();
  const events = new QueueEvents(KSEF_QUEUE, { connection: redisConnection() });
  const client = api();
  const worker = startKsefWorker(client as unknown as KsefClient);
  try {
    await events.waitUntilReady();
    const inv = await invoice();
    await queueTestInvoice(b, inv.id, prepare);
    client.status.mockResolvedValueOnce({ status: { code: 150, description: "Pending" }, ksefNumber: "", acquisitionDate: "" });
    const data = { studioId: b, invoiceId: inv.id };
    const pending = await queue.add("send", data, { jobId: ksefJobId(data), attempts: 3, backoff: { type: "fixed", delay: 20 } });
    await pending.waitUntilFinished(events, 10000);
    expect(client.status).toHaveBeenCalledTimes(2);
    expect(client.submit).toHaveBeenCalledTimes(1);
    expect((await queue.getJob(pending.id!))?.attemptsMade).toBe(2);
    const bad = await invoice();
    await queueTestInvoice(b, bad.id, prepare);
    client.status.mockResolvedValue({ status: { code: 450, description: "Bad NIP" }, ksefNumber: "", acquisitionDate: "" });
    const badData = { studioId: b, invoiceId: bad.id };
    const rejected = await queue.add("send", badData, { jobId: ksefJobId(badData), attempts: 3, backoff: { type: "fixed", delay: 20 } });
    await expect(rejected.waitUntilFinished(events, 10000)).rejects.toThrow("terminal error");
    expect((await queue.getJob(rejected.id!))?.attemptsMade).toBe(1);
    expect((await studioDb(b).invoice.findFirstOrThrow({ where: { id: bad.id } })).ksefStatus).toBe("rejected");
    await pending.remove(); await rejected.remove();
  } finally {
    await worker.close(); await events.close(); await queue.close();
  }
});
