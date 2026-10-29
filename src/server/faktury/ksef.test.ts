import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { invoiceFixture } from "@/src/invoices/fixtures/document";
import { POST } from "@/app/api/studios/[studioId]/invoices/[invoiceId]/ksef/route";
import { saveTestToken } from "@/src/ksef/submissions";
import { encryptToken } from "@/src/ksef/secrets";
import { hash } from "@/src/ksef/client";
import { enqueueKsef } from "@/src/ksef/queue";
const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/src/ksef/queue", () => ({ enqueueKsef: vi.fn() }));
const call = (studioId: string, invoiceId: string, origin = "http://localhost:3000") => POST(new Request("http://localhost:3000/api/invoices/ksef", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ env: "production", xml: "untrusted" }) }), { params: Promise.resolve({ studioId, invoiceId }) });
let userId: string;



const tag = randomUUID();
let a: string, b: string, testId: string;
beforeAll(async () => {
  vi.stubEnv("KSEF_ENV", "test");
  vi.stubEnv("KSEF_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 4).toString("base64"));
  vi.stubEnv("KSEF_PROD_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));
  userId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.test` } })).id;
  mocks.session.mockResolvedValue({ user: { id: userId } });
  const studios = await Promise.all(["a", "b"].map(suffix => platformDb.studio.create({ data: { publicCode: `${tag}-${suffix}`, slug: `${tag}-${suffix}`, status: "active", name: suffix, nip: "9512345678", address: "Rzemieślnicza 12", postal: "02-675", city: "Warszawa" } })));
  a = studios[0]!.id; b = studios[1]!.id;
  for (const studioId of [a, b]) await studioDb(studioId).membership.create({ data: { studioId, userId, role: "manager" } });
  const db = studioDb(b);
  const client = await db.client.create({ data: { studioId: b, name: "Buyer" } });
  const vehicle = await db.vehicle.create({ data: { studioId: b, clientId: client.id, make: "BMW", model: "X3", plate: tag } });
  const fixture = invoiceFixture();
  const order = await db.workOrder.create({ data: { studioId: b, clientId: client.id, vehicleId: vehicle.id, number: "DF-0243", service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), ...fixture.order } });
  for (const ksefEnv of ["test", "production"] as const) {
    const { items } = fixture.invoice;
    const invoice = { ...fixture.invoice, id: undefined, studioId: undefined, items: undefined };
    const result = await db.invoice.create({ data: { ...invoice, studioId: b, workOrderId: order.id, buyerName: ksefEnv, ksefEnv, ksefStatus: "not_sent", ksefNumber: null,
      items: { create: items.map(line => ({ ...line, id: undefined, studioId: undefined, invoiceId: undefined })) },
    } });
    if (ksefEnv === "test") testId = result.id;
  }
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } });
  if (userId) await platformDb.user.delete({ where: { id: userId } });
  vi.unstubAllEnvs();
});
beforeEach(() => vi.mocked(enqueueKsef).mockClear());
it("enforces Origin, session, roles and tenant isolation before submitting", async () => {
  expect((await call(b, testId, "https://evil.example")).status).toBe(403);
  mocks.session.mockResolvedValueOnce(null);
  expect((await call(b, testId)).status).toBe(401);
  await studioDb(b).membership.updateMany({ where: { userId }, data: { role: "worker" } });
  expect((await call(b, testId)).status).toBe(403);
  await studioDb(b).membership.updateMany({ where: { userId }, data: { role: "manager" } });
  expect((await call(a, testId)).status).toBe(404);
  expect(enqueueKsef).not.toHaveBeenCalled();
});
it("rejects absent/mismatched tokens before creating any snapshot, without leaking secrets", async () => {
  const missing = await call(b, testId);
  expect(missing.status).toBe(409);
  expect(await missing.text()).toContain("token");
  const secret = "prod-secret-test-only";
  await platformDb.studio.update({ where: { id: b }, data: { ksefTokenEnc: encryptToken(b, "production", secret) } });
  const mismatch = await call(b, testId);
  expect(mismatch.status).toBe(409);
  expect(await mismatch.text()).not.toContain(secret);
  expect(await studioDb(b).ksefSubmission.count()).toBe(0);
  expect(enqueueKsef).not.toHaveBeenCalled();
});
it("uses invoice environment despite caller body and commits validated XML and history before enqueue", async () => {
  await saveTestToken(b, "test-secret-only");
  const result = await call(b, testId);
  expect(result.status).toBe(202);
  expect(await result.json()).toEqual({ ksefStatus: "queued" });
  const db = studioDb(b);
  expect((await db.invoice.findFirstOrThrow({ where: { id: testId } })).ksefStatus).toBe("queued");
  const snapshot = await db.ksefSubmission.findFirstOrThrow({ where: { invoiceId: testId } });
  expect(snapshot.xml).toContain("<P_15>4800.00</P_15>");
  expect(snapshot.xml).not.toContain("test-secret-only");
  expect(snapshot.xmlHash).toBe(hash(Buffer.from(snapshot.xml)));
  expect(await db.ksefEvent.findFirst({ where: { invoiceId: testId } })).toMatchObject({ kind: "validated", message: expect.stringContaining("TEST") });
  expect(enqueueKsef).toHaveBeenCalledWith({ studioId: b, invoiceId: testId });
  expect((await call(b, testId)).status).toBe(409);
  expect(enqueueKsef).toHaveBeenCalledTimes(1);
});
