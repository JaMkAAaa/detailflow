import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { createInvoiceCheckout, expireInvoiceCheckout, stripeGrosze } from "./checkout";
import { processClientPaymentEvent } from "./webhook";
import { connectStudio } from "./connect";
import { paymentStripe } from "./stripe";
import { markInvoicePaid, correctInvoice } from "../faktury/manage";
import { processStripeEvent } from "../billing/webhook";
import { POST as webhook } from "@/app/api/client-payments/webhook/route";
import { POST as checkoutRoute } from "@/app/api/studios/[studioId]/invoices/[invoiceId]/checkout/route";
import { POST as connectRoute } from "@/app/api/studios/[studioId]/client-payments/connect/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.CLIENT_PAYMENTS_STRIPE_SECRET_KEY = "sk_test_client_payments_local";
  process.env.CLIENT_PAYMENTS_WEBHOOK_SECRET = "whsec_client_payments_local";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID();
let a: string, b: string, orderId: string, invoiceId: string, ownerId: string, managerId: string, workerId: string;
const accountId = `acct_${tag}`;
const customerId = `cus_${tag}`;
let current: Stripe.Checkout.Session;
let intent: Stripe.PaymentIntent;
const retrieve = vi.fn();
const create = vi.fn();
const accountRetrieve = vi.fn();
const customerCreate = vi.fn();
const expire = vi.fn();
const intentRetrieve = vi.fn();
const fake = { accounts: { retrieve: accountRetrieve }, customers: { create: customerCreate }, checkout: { sessions: { retrieve, create, expire } }, paymentIntents: { retrieve: intentRetrieve } } as unknown as Stripe;
const event = (overrides: Partial<Stripe.Event> = {}) => ({ id: `evt_${randomUUID()}`, type: "checkout.session.completed", account: accountId, livemode: false, created: Math.floor(Date.now() / 1000), data: { object: { ...current } }, ...overrides }) as Stripe.Event;
beforeAll(async () => {
  const studios = await Promise.all(["a", "b"].map(s => platformDb.studio.create({ data: { publicCode: `${tag}-${s}`, slug: `${tag}-${s}`, name: s, status: "active", clientPaymentAccountId: s === "a" ? accountId : null } })));
  a = studios[0]!.id; b = studios[1]!.id;
  const users = await Promise.all(["owner", "manager", "worker"].map(role => platformDb.user.create({ data: { name: role, email: `${role}-${tag}@example.test` } })));
  ownerId = users[0]!.id; managerId = users[1]!.id; workerId = users[2]!.id;
  for (const [i, role] of (["owner", "manager", "worker"] as const).entries()) await studioDb(a).membership.create({ data: { studioId: a, userId: users[i]!.id, role } });
  const db = studioDb(a);
  const client = await db.client.create({ data: { studioId: a, name: "Kupujący" } });
  const vehicle = await db.vehicle.create({ data: { studioId: a, clientId: client.id, make: "Test", model: "Test", plate: tag } });
  const order = await db.workOrder.create({ data: { studioId: a, clientId: client.id, vehicleId: vehicle.id, number: "DF-1", service: "Detailing", scheduledFrom: new Date(), scheduledTo: new Date(), totalGross: "123.45", status: "completed", completedAt: new Date() } });
  orderId = order.id;
});
beforeEach(async () => {
  vi.clearAllMocks();
  await studioDb(a).invoice.deleteMany({ where: {} });
  const invoice = await studioDb(a).invoice.create({ data: { studioId: a, workOrderId: orderId, number: "FV/1/10/2026", status: "issued", ksefEnv: "test", buyerName: "Kupujący", issuedAt: new Date(Date.now() - 60_000), totalNet: "100.37", totalVat: "23.08", totalGross: "123.45" } });
  invoiceId = invoice.id;
  current = { id: `cs_${invoiceId}`, mode: "payment", status: "open", payment_status: "unpaid", customer: customerId, currency: "pln", amount_total: 12345, amount_subtotal: 12345, livemode: false, client_reference_id: invoiceId, metadata: { studioId: a, invoiceId }, url: "https://checkout.stripe.com/c/pay/test" } as unknown as Stripe.Checkout.Session;
  intent = { id: `pi_${invoiceId}`, status: "succeeded", customer: customerId, currency: "pln", amount: 12345, amount_received: 12345, metadata: { studioId: a, invoiceId }, livemode: false } as unknown as Stripe.PaymentIntent;
  accountRetrieve.mockResolvedValue({ id: accountId, type: "standard", metadata: { studioId: a }, charges_enabled: true, payouts_enabled: true, capabilities: { card_payments: "active" } });
  retrieve.mockImplementation(async () => ({ ...current }));
  create.mockImplementation(async () => ({ ...current }));
  customerCreate.mockResolvedValue({ id: customerId });
  expire.mockImplementation(async () => { current = { ...current, status: "expired", url: null }; return current; });
  intentRetrieve.mockImplementation(async () => ({ ...intent }));
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: [a, b].filter(Boolean) } } });
  await platformDb.user.deleteMany({ where: { id: { in: [ownerId, managerId, workerId].filter(Boolean) } } });
});
const checkout = () => createInvoiceCheckout(a, invoiceId, fake);
async function paid() { await checkout(); current = { ...current, status: "complete", payment_status: "paid", payment_intent: intent.id }; }
it("converts Decimal PLN exactly and bounds safe Stripe integers", () => {
  expect(stripeGrosze("123.45")).toBe(12345);
  expect(stripeGrosze("2.00")).toBe(200);
  expect(stripeGrosze("999999.99")).toBe(99999999);
  for (const value of ["0", "-1", "0.49", "1.99", "2.001", "1000000", "9999999999999999999"]) expect(() => stripeGrosze(value)).toThrow();
});
it("creates direct card-only Checkout with exact gross amount, no fee and reuses an open session", async () => {
  await Promise.all([checkout(), checkout()]);
  expect(create).toHaveBeenCalledTimes(1);
  const [params, options] = create.mock.calls[0]!;
  expect(params).toMatchObject({ mode: "payment", customer: customerId, allowed_payment_method_types: ["card"], metadata: { studioId: a, invoiceId }, line_items: [{ quantity: 1, price_data: { currency: "pln", unit_amount: 12345 } }], payment_intent_data: { metadata: { studioId: a, invoiceId } } });
  expect(options.stripeAccount).toBe(accountId);
  expect(params.payment_intent_data.application_fee_amount).toBeUndefined();
  expect(params.payment_intent_data.transfer_data).toBeUndefined();
  expect(customerCreate.mock.calls[0]![1].stripeAccount).toBe(accountId);
});
it("isolates two tenants and rejects incomplete onboarding and wrong account type", async () => {
  await expect(createInvoiceCheckout(b, invoiceId, fake)).rejects.toMatchObject({ status: 409 });
  // Nawet skonfigurowane drugie studio nie odczyta obcej FV.
  await platformDb.studio.update({ where: { id: b }, data: { clientPaymentAccountId: `acct_b_${tag}` } });
  accountRetrieve.mockResolvedValueOnce({ id: `acct_b_${tag}`, type: "standard", metadata: { studioId: b }, charges_enabled: true, payouts_enabled: true, capabilities: { card_payments: "active" } });
  await expect(createInvoiceCheckout(b, invoiceId, fake)).rejects.toMatchObject({ status: 404 });
  await platformDb.studio.update({ where: { id: b }, data: { clientPaymentAccountId: null } });
  for (const change of [{ charges_enabled: false }, { type: "express" }, { metadata: { studioId: b } }, { payouts_enabled: false }]) {
    accountRetrieve.mockResolvedValueOnce({ id: accountId, type: "standard", metadata: { studioId: a }, charges_enabled: true, payouts_enabled: true, capabilities: { card_payments: "active" }, ...change });
    await expect(checkout()).rejects.toMatchObject({ status: 409 });
  }
  expect(create).not.toHaveBeenCalled();
});
it("rejects drafts, corrections, paid documents, corrected invoices and unfinished orders", async () => {
  for (const change of [{ status: "draft" }, { paidAt: new Date() }]) {
    await studioDb(a).invoice.update({ where: { id: invoiceId }, data: change as { status?: "draft"; kind?: "correction"; paidAt?: Date } });
    await expect(checkout()).rejects.toMatchObject({ status: 409 });
    await studioDb(a).invoice.update({ where: { id: invoiceId }, data: { status: "issued", kind: "invoice", paidAt: null } });
  }
  await studioDb(a).workOrder.update({ where: { id: orderId }, data: { status: "in_progress" } });
  await expect(checkout()).rejects.toMatchObject({ status: 409 });
  await studioDb(a).workOrder.update({ where: { id: orderId }, data: { status: "completed" } });
  const correction = await studioDb(a).invoice.create({ data: { studioId: a, workOrderId: orderId, number: "KFV/1", kind: "correction", correctsInvoiceId: invoiceId, status: "issued", ksefEnv: "test", buyerName: "x", totalNet: "-1", totalVat: "0", totalGross: "-1" } });
  await expect(checkout()).rejects.toMatchObject({ status: 409 });
  await expect(createInvoiceCheckout(a, correction.id, fake)).rejects.toMatchObject({ status: 409 });
});
it("replaces expired unpaid sessions, blocks completed and pending sessions", async () => {
  await checkout();
  current = { ...current, status: "expired" };
  const next = { ...current, id: "cs_next", status: "open" };
  create.mockResolvedValueOnce(next);
  await checkout();
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0]![1].idempotencyKey).not.toBe(create.mock.calls[1]![1].idempotencyKey);
  current = { ...next, status: "complete", payment_status: "unpaid" } as unknown as Stripe.Checkout.Session;
  await expect(checkout()).rejects.toMatchObject({ status: 409 });
});
it("validates signed payload, current session, intent, account, customer, amount and currency", async () => {
  await paid();
  const original = { ...current };
  for (const change of [{ customer: "cus_foreign" }, { currency: "eur" }, { amount_total: 1 }, { amount_subtotal: 1 }, { metadata: { studioId: a, invoiceId: "foreign" } }, { livemode: true }]) {
    const e = event();
    current = { ...original, ...change } as unknown as Stripe.Checkout.Session;
    await expect(processClientPaymentEvent(e, fake)).rejects.toThrow();
  }
  current = original;
  await expect(processClientPaymentEvent(event({ account: "acct_foreign" }), fake)).rejects.toThrow();
  const originalIntent = { ...intent };
  for (const change of [{ customer: "cus_foreign" }, { amount_received: 1 }, { currency: "eur" }, { application_fee_amount: 1 }, { transfer_data: { destination: "acct_foreign" } }, { status: "processing" }]) {
    intent = { ...originalIntent, ...change } as unknown as Stripe.PaymentIntent;
    await expect(processClientPaymentEvent(event(), fake)).rejects.toThrow();
  }
  expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paidAt).toBeNull();
  expect(await studioDb(a).clientPaymentEvent.count()).toBe(0);
});
it("sets paidAt once with retries, concurrent replay and new event IDs; leaves KSeF/Billing intact", async () => {
  await paid();
  const e = event();
  retrieve.mockRejectedValueOnce(new Error("temporary Stripe outage"));
  await expect(processClientPaymentEvent(e, fake)).rejects.toThrow();
  expect(await studioDb(a).clientPaymentEvent.count()).toBe(0);
  await Promise.all([processClientPaymentEvent(e, fake), processClientPaymentEvent(e, fake)]);
  const first = await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } });
  expect(first.paidAt).not.toBeNull();
  await processClientPaymentEvent(event(), fake);
  const second = await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } });
  expect(second.paidAt).toEqual(first.paidAt);
  expect(second.ksefStatus).toBe("not_sent");
  await studioDb(a).invoice.create({ data: { studioId: a, workOrderId: orderId, number: "KFV/replay", kind: "correction", correctsInvoiceId: invoiceId, status: "issued", ksefEnv: "test", buyerName: "x", totalNet: "-1", totalVat: "0", totalGross: "-1" } });
  await processClientPaymentEvent(event(), fake);
  expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paidAt).toEqual(first.paidAt);
  expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeNull();
  await processStripeEvent(e, fake);
  expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeNull();
});
it("does not trust a success redirect or unpaid completion; ignores platform/live/subscription events", async () => {
  await checkout();
  for (const override of [{ account: undefined }, { livemode: true }, { type: "invoice.paid" }]) await processClientPaymentEvent(event(override as Partial<Stripe.Event>), fake);
  current = { ...current, status: "complete", payment_status: "unpaid" };
  await processClientPaymentEvent(event(), fake);
  expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paidAt).toBeNull();
});
it("excludes manual payment and correction until remote expiry is confirmed", async () => {
  await checkout();
  const spy = vi.spyOn(paymentStripe().checkout.sessions, "retrieve").mockImplementation(async () => ({ ...current }) as Stripe.Response<Stripe.Checkout.Session>);
  try {
    await expect(markInvoicePaid(a, invoiceId, {})).rejects.toMatchObject({ status: 409 });
    await expect(correctInvoice(a, invoiceId, { reason: "x", items: [{ lp: 1, quantity: "0", unitNet: "0" }] })).rejects.toMatchObject({ status: 409 });
    await expireInvoiceCheckout(a, invoiceId, fake);
    await markInvoicePaid(a, invoiceId, {});
    await expect(checkout()).rejects.toMatchObject({ status: 409 });
  } finally { spy.mockRestore(); }
});
it("refuses expiry of a completed payment and never overwrites a manual payment on webhook", async () => {
  await paid();
  await expect(expireInvoiceCheckout(a, invoiceId, fake)).rejects.toMatchObject({ status: 409 });
  const manual = new Date("2026-10-29T10:00:00Z");
  await studioDb(a).invoice.update({ where: { id: invoiceId }, data: { paidAt: manual } });
  await expect(processClientPaymentEvent(event(), fake)).rejects.toThrow();
  expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paidAt).toEqual(manual);
});
it("creates only Standard onboarding and reuses persisted account across retries", async () => {
  const accountsCreate = vi.fn().mockResolvedValue({ id: `acct_b_${tag}`, type: "standard" });
  const accountLinks = vi.fn().mockResolvedValue({ url: "https://connect.stripe.com/setup/test" });
  const stripe = { accounts: { create: accountsCreate }, accountLinks: { create: accountLinks } } as unknown as Stripe;
  await Promise.all([connectStudio(b, stripe), connectStudio(b, stripe)]);
  expect(accountsCreate).toHaveBeenCalledTimes(1);
  expect(accountsCreate.mock.calls[0]![0]).toEqual({ type: "standard", country: "PL", metadata: { studioId: b } });
  expect(accountLinks.mock.calls[0]![0]).toMatchObject({ account: `acct_b_${tag}`, type: "account_onboarding" });
  await platformDb.studio.update({ where: { id: b }, data: { clientPaymentAccountId: null } });
});
it("verifies raw signatures and timestamp, and rejects Billing secret", async () => {
  const sdk = paymentStripe();
  const raw = JSON.stringify(event({ type: "customer.created" }));
  const sign = (secret: string, timestamp?: number) => sdk.webhooks.generateTestHeaderString({ payload: raw, secret, timestamp });
  const request = (signature?: string, body = raw) => new Request("http://localhost:3000/api/client-payments/webhook", { method: "POST", body, headers: signature ? { "stripe-signature": signature } : {} });
  expect((await webhook(request(sign("whsec_client_payments_local")))).status).toBe(200);
  expect((await webhook(request())).status).toBe(400);
  expect((await webhook(request(sign("whsec_billing")))).status).toBe(400);
  expect((await webhook(request(sign("whsec_client_payments_local", 1)))).status).toBe(400);
  expect((await webhook(request(sign("whsec_client_payments_local"), raw + " "))).status).toBe(400);
});
it("guards routes with authentication, tenant membership, role and Origin; rejects supplied amounts", async () => {
  const request = (origin = "http://localhost:3000", body?: string) => new Request("http://localhost:3000/api/checkout", { method: "POST", headers: { origin }, body });
  const ctx = (studioId = a) => ({ params: Promise.resolve({ studioId, invoiceId }) });
  mocks.session.mockResolvedValue(null);
  expect((await checkoutRoute(request(), ctx())).status).toBe(401);
  mocks.session.mockResolvedValue({ user: { id: ownerId } });
  expect((await checkoutRoute(request(), ctx(b))).status).toBe(403);
  expect((await checkoutRoute(request("https://evil.test"), ctx())).status).toBe(403);
  expect((await checkoutRoute(request(undefined, '{"amount":1,"customer":"foreign"}'), ctx())).status).toBe(400);
  mocks.session.mockResolvedValue({ user: { id: workerId } });
  expect((await checkoutRoute(request(), ctx())).status).toBe(403);
  mocks.session.mockResolvedValue({ user: { id: managerId } });
  expect((await connectRoute(request(), ctx())).status).toBe(403);
});

it("serializes a manual payment racing a new online checkout", async () => {
  const spy = vi.spyOn(paymentStripe().checkout.sessions, "retrieve").mockImplementation(async () => ({ ...current }) as Stripe.Response<Stripe.Checkout.Session>);
  try {
    const results = await Promise.allSettled([checkout(), markInvoicePaid(a, invoiceId, {})]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const invoice = await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } });
    expect(Boolean(invoice.paidAt)).not.toBe(Boolean(invoice.paymentSessionId));
  } finally { spy.mockRestore(); }
});
it("returns retryable failure on a signed webhook, then commits on retry", async () => {
  await paid();
  const e = event();
  const sdk = paymentStripe();
  const raw = JSON.stringify(e);
  const signature = sdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_client_payments_local" });
  const request = () => new Request("http://localhost:3000/api/client-payments/webhook", { method: "POST", body: raw, headers: { "stripe-signature": signature } });
  const sessions = vi.spyOn(sdk.checkout.sessions, "retrieve").mockRejectedValueOnce(new Error("temporary outage"))
    .mockImplementation(async () => ({ ...current }) as Stripe.Response<Stripe.Checkout.Session>);
  const intents = vi.spyOn(sdk.paymentIntents, "retrieve").mockImplementation(async () => ({ ...intent }) as Stripe.Response<Stripe.PaymentIntent>);
  try {
    expect((await webhook(request())).status).toBe(500);
    expect(await studioDb(a).clientPaymentEvent.count()).toBe(0);
    expect((await webhook(request())).status).toBe(200);
    expect((await webhook(request())).status).toBe(200);
    expect(await studioDb(a).clientPaymentEvent.count()).toBe(1);
    expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paidAt).not.toBeNull();
  } finally { sessions.mockRestore(); intents.mockRestore(); }
});

it("keeps a durable reservation after an uncertain Stripe create and recovers the same attempt", async () => {
  create.mockRejectedValueOnce(new Error("response lost after remote create"));
  await expect(checkout()).rejects.toThrow("response lost");
  const invoice = await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } });
  expect(invoice.paymentPending).toBe(true);
  expect(invoice.paymentSessionId).toBeNull();
  await expect(markInvoicePaid(a, invoiceId, {})).rejects.toMatchObject({ status: 409 });
  await expect(expireInvoiceCheckout(a, invoiceId, fake)).rejects.toMatchObject({ status: 409 });
  await checkout();
  expect(create.mock.calls[0]![1].idempotencyKey).toBe(create.mock.calls[1]![1].idempotencyKey);
  expect(create.mock.calls[0]![0]).toEqual(create.mock.calls[1]![0]);
  expect((await studioDb(a).invoice.findFirstOrThrow({ where: { id: invoiceId } })).paymentPending).toBe(false);
});
it("fails closed for unresolved reservations older than Stripe idempotency retention", async () => {
  await studioDb(a).invoice.update({ where: { id: invoiceId }, data: { paymentPending: true, paymentPendingAt: new Date(Date.now() - 24 * 60 * 60_000) } });
  await expect(checkout()).rejects.toMatchObject({ status: 409 });
  await expect(markInvoicePaid(a, invoiceId, {})).rejects.toMatchObject({ status: 409 });
  expect(create).not.toHaveBeenCalled();
});
