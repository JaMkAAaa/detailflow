import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { platformDb } from "@/lib/db/client";
import { studioDb } from "@/lib/db/tenant";
import { apiStudio } from "../http";
import { createBillingPortal } from "./portal";
import { sendTrialReminders } from "./trial";
import { POST as portalRoute } from "@/app/api/studios/[studioId]/billing/portal/route";

const mocks = vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.APP_URL = "http://localhost:3000";
  process.env.SMTP_URL = "smtp://localhost:1025";
  return { session: vi.fn(), sendMail: vi.fn() };
});
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("nodemailer", () => ({ createTransport: () => ({ sendMail: mocks.sendMail }) }));
const tag = randomUUID();
const now = new Date("2030-01-01T12:00:00Z");
const DAY = 86_400_000;
let studioId: string, foreignId: string, ownerId: string, workerId: string;
const request = (method = "POST", path = "invoices", origin = "http://localhost:3000") => new Request(`http://localhost:3000/api/studios/${studioId}/${path}`, { method, headers: { origin } });

beforeAll(async () => {
  ownerId = (await platformDb.user.create({ data: { name: tag, email: `${tag}@example.com` } })).id;
  workerId = (await platformDb.user.create({ data: { name: tag, email: `${tag}-worker@example.com` } })).id;
  for (const suffix of ["a", "b"]) {
    const studio = await platformDb.studio.create({ data: { name: tag, slug: `${tag}-${suffix}`, publicCode: `${tag}-${suffix}`, status: "active" } });
    if (suffix === "a") studioId = studio.id; else foreignId = studio.id;
  }
  await studioDb(studioId).membership.createMany({ data: [{ studioId, userId: ownerId, role: "owner" }, { studioId, userId: workerId, role: "worker" }] });
});
beforeEach(async () => {
  mocks.session.mockResolvedValue({ user: { id: ownerId } });
  mocks.sendMail.mockReset().mockResolvedValue({});
  await platformDb.studio.update({ where: { id: studioId }, data: { status: "trial", trialEndsAt: new Date(now.getTime() + 3 * DAY), trialReminderSentAt: null, stripeCustomerId: `cus_${tag}` } });
});
afterAll(async () => {
  await platformDb.studio.deleteMany({ where: { id: { in: [studioId, foreignId] } } });
  await platformDb.user.deleteMany({ where: { id: { in: [ownerId, workerId] } } });
});

describe("restricted billing (Postgres)", () => {
  it("po zmianie statusu blokuje wszystkie metody zapisu, zachowuje odczyt i billing", async () => {
    for (const status of ["past_due", "canceled", "suspended", "trial"] as const) {
      await platformDb.studio.update({ where: { id: studioId }, data: { status, trialEndsAt: new Date(0) } });
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) await expect(apiStudio(request(method), studioId, "invoices:manage")).rejects.toMatchObject({ status: 403 });
      await expect(apiStudio(request("GET"), studioId, "invoices:manage")).resolves.toBeDefined();
      await expect(apiStudio(request("POST", "billing/portal"), studioId, "billing:manage")).resolves.toBeDefined();
      await expect(apiStudio(new Request("http://localhost:3000/api/studios/active", { method: "POST" }), studioId, "studio:select")).resolves.toBeDefined();
    }
    await expect(apiStudio(request("GET"), foreignId)).rejects.toMatchObject({ status: 403 });
    expect(await platformDb.studio.findUniqueOrThrow({ where: { id: foreignId } })).toMatchObject({ status: "active" });
  });
  it("active i niewygasły trial pozwalają na zapis", async () => {
    await expect(apiStudio(request(), studioId, "invoices:manage")).resolves.toBeDefined();
    await platformDb.studio.update({ where: { id: studioId }, data: { status: "active" } });
    await expect(apiStudio(request(), studioId, "invoices:manage")).resolves.toBeDefined();
  });
  it("portal wiąże customer z tenantem i wymaga właściciela, sesji i Origin", async () => {
    const create = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" });
    const stripe = { billingPortal: { sessions: { create } } } as unknown as Stripe;
    expect(await createBillingPortal(ownerId, studioId, stripe)).toEqual({ url: "https://billing.stripe.com/test" });
    expect(create).toHaveBeenCalledWith({ customer: `cus_${tag}`, return_url: "http://localhost:3000/billing", locale: "pl" });
    await expect(createBillingPortal(ownerId, foreignId, stripe)).rejects.toMatchObject({ status: 403 });
    await expect(createBillingPortal(workerId, studioId, stripe)).rejects.toMatchObject({ status: 403 });
    expect(create).toHaveBeenCalledTimes(1);
    const ctx = { params: Promise.resolve({ studioId }) };
    expect((await portalRoute(request("POST", "billing/portal", "https://evil.example"), ctx)).status).toBe(403);
    mocks.session.mockResolvedValue(null);
    expect((await portalRoute(request("POST", "billing/portal"), ctx)).status).toBe(401);
    await platformDb.studio.update({ where: { id: studioId }, data: { stripeCustomerId: null } });
    await expect(createBillingPortal(ownerId, studioId, stripe)).rejects.toMatchObject({ status: 409 });
  });
});

describe("trial reminders (Postgres)", () => {
  it("wysyła raz na trial także przy równoległych uruchomieniach, tylko do właściciela tenanta", async () => {
    await Promise.all([sendTrialReminders(now), sendTrialReminders(now)]);
    await sendTrialReminders(now);
    expect(mocks.sendMail).toHaveBeenCalledTimes(1);
    expect(mocks.sendMail.mock.calls[0]![0]).toMatchObject({ to: [`${tag}@example.com`], text: expect.stringContaining("http://localhost:3000/billing") });
    expect(await platformDb.studio.findUniqueOrThrow({ where: { id: studioId } })).toMatchObject({ trialReminderSentAt: now });
  });
  it("ponawia błąd SMTP i nadrabia opuszczony dzień przypomnienia", async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error("SMTP down"));
    await expect(sendTrialReminders(now)).rejects.toThrow();
    expect((await platformDb.studio.findUniqueOrThrow({ where: { id: studioId } })).trialReminderSentAt).toBeNull();
    await sendTrialReminders(new Date(now.getTime() + DAY));
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
  });
  it("pomija aktywne, odległe i wygasłe triale", async () => {
    for (const data of [{ status: "active" as const }, { trialEndsAt: new Date(now.getTime() + 3 * DAY + 1) }, { trialEndsAt: now }]) {
      await platformDb.studio.update({ where: { id: studioId }, data: { status: "trial", ...data } });
      await sendTrialReminders(now);
    }
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
