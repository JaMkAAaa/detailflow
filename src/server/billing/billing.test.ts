import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { createCheckout } from "./checkout";
import { processStripeEvent, subscriptionStatus } from "./webhook";
import { POST as webhook } from "@/app/api/stripe/webhook/route";
import { POST as checkoutRoute } from "@/app/api/studios/[studioId]/billing/checkout/route";
import { pricePlan } from "./plans";
import { authorizeStudio } from "../acl";
import { getStripe } from "./stripe";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.STRIPE_SECRET_KEY = "sk_test_local";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_local";
  return { session: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
const tag = randomUUID();
const stripeSdk = new Stripe("sk_test_local");
const customerId = `cus_${tag}`;
const subId = `sub_${tag}`;
let studioId: string;
let foreignId: string;
let ownerId: string;
let workerId: string;
const eventIds: string[] = [];
const price = { id: "price_studio", active: true, lookup_key: "plan_studio_monthly", currency: "pln", unit_amount: 14900, tax_behavior: "exclusive", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" } } as Stripe.Price;
function subscription(overrides: Partial<Stripe.Subscription> = {}) {
  return { id: subId, customer: customerId, metadata: { studioId }, status: "active", created: 100,
    items: { data: [{ quantity: 1, price }] }, latest_invoice: "in_test", ...overrides } as Stripe.Subscription;
}
function event(type: string, object: unknown) {
  const id = `evt_${randomUUID()}`; eventIds.push(id);
  return { id, type, created: 100, data: { object } } as Stripe.Event;
}
function client(sub = subscription()) {
  return {
    subscriptions: { retrieve: vi.fn<(id: string) => Promise<Stripe.Subscription>>().mockResolvedValue(sub), list: vi.fn<() => Promise<{ data: Stripe.Subscription[] }>>().mockResolvedValue({ data: [] }) },
    invoices: { retrieve: vi.fn().mockResolvedValue({ id: "in_test", status: "open" }) },
    prices: { list: vi.fn().mockResolvedValue({ data: [price] }) },
    customers: { create: vi.fn().mockResolvedValue({ id: customerId }) },
    checkout: { sessions: { list: vi.fn<() => Promise<{ data: Partial<Stripe.Checkout.Session>[] }>>().mockResolvedValue({ data: [] }), create: vi.fn<(params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string }>>().mockResolvedValue({ url: "https://checkout.stripe.com/test" }), expire: vi.fn() } },
  };
}
const asStripe = (mock: ReturnType<typeof client>) => mock as unknown as Stripe;
beforeAll(async () => {
  const owner = await platformDb.user.create({ data: { name: "Owner", email: `${tag}-owner@example.com` } }); ownerId = owner.id;
  const worker = await platformDb.user.create({ data: { name: "Worker", email: `${tag}-worker@example.com` } }); workerId = worker.id;
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, trialEndsAt: new Date(0) } });
    if (suffix === "a") studioId = studio.id; else foreignId = studio.id;
  }
  await studioDb(studioId).membership.createMany({ data: [{ studioId, userId: ownerId, role: "owner" }, { studioId, userId: workerId, role: "worker" }] });
});
beforeEach(async () => {
  await platformDb.subscriptionPayment.deleteMany({ where: { OR: [{ studioId }, { stripeInvoiceId: "in_test" }] } });
  await platformDb.studio.update({ where: { id: studioId }, data: { status: "trial", plan: "solo", stripeCustomerId: customerId, stripeSubscriptionId: null, trialEndsAt: new Date(0) } });
});
afterAll(async () => {
  await platformDb.auditLog.deleteMany({ where: { studioId: { in: [studioId, foreignId] } } });
  await platformDb.stripeEvent.deleteMany({ where: { id: { in: eventIds } } });
  await platformDb.studio.deleteMany({ where: { id: { in: [studioId, foreignId] } } });
  await platformDb.user.deleteMany({ where: { id: { in: [ownerId, workerId] } } });
});

describe("billing with Postgres and mocked Stripe transport", () => {
  it("atomically claims concurrent replays once and changes only the linked tenant", async () => {
    const e = event("customer.subscription.created", subscription());
    const stripe = client();
    await Promise.all([processStripeEvent(e, asStripe(stripe)), processStripeEvent(e, asStripe(stripe))]);
    await processStripeEvent(e, asStripe(stripe));
    expect(await platformDb.stripeEvent.count({ where: { id: e.id } })).toBe(1);
    expect(await platformDb.auditLog.count({ where: { studioId, meta: { path: ["eventId"], equals: e.id } } })).toBe(1);
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "active", plan: "studio", stripeSubscriptionId: subId });
    expect(await platformDb.studio.findUnique({ where: { id: foreignId } })).toMatchObject({ status: "trial", plan: "solo", stripeCustomerId: null, stripeSubscriptionId: null });
  });
  it("payment_failed sets past_due; paid recovers from current Stripe state and records paid amount", async () => {
    const invoice = { id: "in_test", customer: customerId, parent: { subscription_details: { subscription: subId } }, amount_paid: 0, currency: "pln" };
    const failed = event("invoice.payment_failed", invoice);
    await processStripeEvent(failed, asStripe(client(subscription({ status: "past_due" }))));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "past_due" });
    const paid = event("invoice.paid", { ...invoice, amount_paid: 18327, total_excluding_tax: 14900, status_transitions: { paid_at: 1_761_480_000 } });
    const stripe = client(); stripe.invoices.retrieve.mockResolvedValue({ id: "in_test", status: "paid" });
    await processStripeEvent(paid, asStripe(stripe));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "active" });
    expect(await platformDb.invoice.count({ where: { studioId } })).toBe(0); // nigdy FV KSeF
    expect((await platformDb.subscriptionPayment.findUnique({ where: { stripeInvoiceId: "in_test" } }))?.amountNet.toFixed(2)).toBe("149.00");
    expect(await platformDb.subscriptionPayment.count({ where: { studioId: foreignId } })).toBe(0);
    // Stary event failed, gdy faktura jest już paid, nie cofa do past_due.
    await processStripeEvent(event("invoice.payment_failed", invoice), asStripe(stripe));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "active" });
  });
  it("uses current subscription rather than a stale active snapshot", async () => {
    await processStripeEvent(event("customer.subscription.updated", subscription()), asStripe(client(subscription({ status: "canceled" }))));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "canceled" });
    expect((await authorizeStudio(ownerId, studioId)).restriction).toContain("anulowany");
    await expect(authorizeStudio(ownerId, studioId, "invoices:manage", true)).rejects.toMatchObject({ status: 403 });
    expect(subscriptionStatus("paused")).toBe("suspended");
    expect(subscriptionStatus("unpaid")).toBe("suspended");
  });
  it("does not replace a new subscription with delayed events of the previous one", async () => {
    await platformDb.studio.update({ where: { id: studioId }, data: { status: "active", stripeSubscriptionId: "sub_new" } });
    const stripe = client(subscription({ status: "canceled" }));
    stripe.subscriptions.retrieve.mockImplementation(async id => subscription(id === "sub_new" ? { id: "sub_new", created: 200 } : { status: "canceled" }));
    await processStripeEvent(event("customer.subscription.deleted", subscription()), asStripe(stripe));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "active", stripeSubscriptionId: "sub_new" });
  });
  it("rolls back the claim on failure and permits a successful retry", async () => {
    const e = event("customer.subscription.updated", subscription());
    const stripe = client(subscription({ items: { data: [] } } as unknown as Partial<Stripe.Subscription>));
    await expect(processStripeEvent(e, asStripe(stripe))).rejects.toThrow();
    expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeNull();
    await processStripeEvent(e, asStripe(client()));
    expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeTruthy();
  });
  it("rejects metadata/customer mismatches without touching either tenant", async () => {
    const e = event("customer.subscription.created", subscription());
    await expect(processStripeEvent(e, asStripe(client(subscription({ metadata: { studioId: foreignId } }))))).rejects.toThrow();
    expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeNull();
    expect(await platformDb.studio.findUnique({ where: { id: foreignId } })).toMatchObject({ status: "trial" });
    const session = event("checkout.session.completed", { mode: "subscription", subscription: subId, customer: customerId, client_reference_id: foreignId, metadata: { studioId: foreignId } });
    await expect(processStripeEvent(session, asStripe(client()))).rejects.toThrow("tenant");
  });
  it("processes completed subscription Checkout and ignores one-off invoices", async () => {
    await processStripeEvent(event("checkout.session.completed", { mode: "subscription", subscription: subId, customer: customerId, client_reference_id: studioId, metadata: { studioId } }), asStripe(client()));
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ status: "active" });
    const stripe = client();
    await processStripeEvent(event("invoice.paid", { parent: null }), asStripe(stripe));
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
  it("requires owner, same tenant, and expired trial before any Stripe calls", async () => {
    const stripe = client();
    await expect(createCheckout(workerId, studioId, { plan: "studio" }, asStripe(stripe))).rejects.toMatchObject({ status: 403 });
    await expect(createCheckout(ownerId, foreignId, { plan: "studio" }, asStripe(stripe))).rejects.toMatchObject({ status: 403 });
    await platformDb.studio.update({ where: { id: studioId }, data: { trialEndsAt: new Date(Date.now() + 86400000) } });
    await expect(createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe))).rejects.toMatchObject({ status: 409 });
    expect(stripe.prices.list).not.toHaveBeenCalled();
    expect(stripe.customers.create).not.toHaveBeenCalled();
  });
  it("creates paid monthly Checkout without extending the trial and reuses open sessions", async () => {
    const stripe = client();
    await createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe));
    expect(stripe.prices.list).toHaveBeenCalledWith(expect.objectContaining({ lookup_keys: ["plan_studio_monthly"] }));
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "subscription", customer: customerId, subscription_data: { metadata: { studioId } }, line_items: [{ price: price.id, quantity: 1 }] }));
    expect(stripe.checkout.sessions.create.mock.calls[0]![0].subscription_data).not.toHaveProperty("trial_period_days");
    stripe.checkout.sessions.list.mockResolvedValue({ data: [{ mode: "subscription", metadata: { studioId, plan: "studio" }, url: "https://checkout.stripe.com/open" }] });
    stripe.checkout.sessions.create.mockClear();
    expect(await createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe))).toEqual({ url: "https://checkout.stripe.com/open" });
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    stripe.subscriptions.list.mockResolvedValue({ data: [subscription()] });
    await expect(createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe))).rejects.toMatchObject({ status: 409 });
  });
  it("rejects annual, foreign-currency, gross and unrecognized prices", () => {
    for (const bad of [{ currency: "eur" }, { unit_amount: 149 }, { tax_behavior: "inclusive" }, { lookup_key: "other" }, { recurring: { interval: "year", interval_count: 1 } }]) {
      expect(() => pricePlan({ ...price, ...bad } as Stripe.Price)).toThrow();
    }
  });
  it("serializes concurrent Checkout calls, creating one customer and one open session", async () => {
    await platformDb.studio.update({ where: { id: studioId }, data: { stripeCustomerId: null } });
    const stripe = client();
    const sessions: Partial<Stripe.Checkout.Session>[] = [];
    stripe.checkout.sessions.list.mockImplementation(async () => ({ data: sessions }));
    stripe.checkout.sessions.create.mockImplementation(async params => {
      const session = { mode: "subscription" as const, metadata: params.metadata as Stripe.Metadata, url: "https://checkout.stripe.com/concurrent" };
      sessions.push(session);
      return session;
    });
    const results = await Promise.all([
      createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe)),
      createCheckout(ownerId, studioId, { plan: "studio" }, asStripe(stripe)),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(stripe.customers.create).toHaveBeenCalledTimes(1);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledTimes(1);
    expect(await platformDb.studio.findUnique({ where: { id: studioId } })).toMatchObject({ stripeCustomerId: customerId, status: "trial" });
  });
  it("returns 500 on processing failure and accepts the same signed event on retry", async () => {
    const e = event("customer.subscription.updated", subscription());
    const raw = JSON.stringify(e);
    const signature = stripeSdk.webhooks.generateTestHeaderString({ payload: raw, secret: "whsec_local" });
    const request = () => new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": signature }, body: raw });
    const retrieve = vi.spyOn(getStripe().subscriptions, "retrieve").mockRejectedValueOnce(new Error("transport unavailable"))
      .mockResolvedValue(subscription() as Stripe.Response<Stripe.Subscription>);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await webhook(request())).status).toBe(500);
      expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeNull();
      expect((await webhook(request())).status).toBe(200);
      expect(await platformDb.stripeEvent.findUnique({ where: { id: e.id } })).toBeTruthy();
    } finally { retrieve.mockRestore(); log.mockRestore(); }
  });
  it("verifies raw body/signature, rejects changes and expired signatures", async () => {
    const raw = JSON.stringify(event("customer.created", { id: "cus_unrelated" }), null, 2);
    const sign = (body: string, timestamp?: number) => stripeSdk.webhooks.generateTestHeaderString({ payload: body, secret: "whsec_local", timestamp });
    const request = (body: string, signature?: string) => new Request("http://localhost:3000/api/stripe/webhook", { method: "POST", headers: signature ? { "stripe-signature": signature } : {}, body });
    expect((await webhook(request(raw, sign(raw)))).status).toBe(200);
    expect((await webhook(request(raw))).status).toBe(400);
    expect((await webhook(request(raw + " ", sign(raw)))).status).toBe(400);
    expect((await webhook(request(raw, sign(raw, 1)))).status).toBe(400);
  });
  it("guards Checkout endpoint with session, membership and CSRF origin", async () => {
    const request = (origin = "http://localhost:3000") => new Request("http://localhost:3000/api/checkout", { method: "POST", headers: { origin }, body: JSON.stringify({ plan: "studio" }) });
    const ctx = (id = studioId) => ({ params: Promise.resolve({ studioId: id }) });
    mocks.session.mockResolvedValue(null);
    expect((await checkoutRoute(request(), ctx())).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { id: ownerId } });
    expect((await checkoutRoute(request(), ctx(foreignId))).status).toBe(403);
    expect((await checkoutRoute(request("https://evil.example"), ctx())).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { id: workerId } });
    expect((await checkoutRoute(request(), ctx())).status).toBe(403);
  });
});
