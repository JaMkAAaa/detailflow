import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import Stripe from "stripe";
import { platformOperator } from "./accounts";
import { exec, one } from "./db";

test.use({ storageState: { cookies: [], origins: [] } });

const webhookSecret = "whsec_e2e_detailflow";
const stripe = new Stripe("sk_test_e2e_detailflow");

test("@smoke webhook invoice.payment_failed ustawia past_due i pojawia się w A-04", async ({ page }) => {
  const tag = randomBytes(4).toString("hex");
  const name = `E2E Zaległość ${tag}`;
  const customerId = `cus_e2e_${tag}`;
  const subscriptionId = `sub_e2e_${tag}`;
  const invoiceId = `in_e2e_${tag}`;
  const eventId = `evt_e2e_${tag}`;
  const studioId = randomUUID();
  await exec(
    `INSERT INTO "Studio" (id, "publicCode", slug, name, status, plan, "stripeCustomerId", "stripeSubscriptionId", "ksefEnv", "updatedAt")
     VALUES ($1, $2, $3, $4, 'active', 'studio', $5, $6, 'test', NOW())`,
    [studioId, `E2B${tag}`, `e2e-billing-${tag}`, name, customerId, subscriptionId],
  );

  try {
    const price = {
      id: "price_studio",
      object: "price",
      active: true,
      lookup_key: "plan_studio_monthly",
      currency: "pln",
      unit_amount: 14900,
      tax_behavior: "exclusive",
      type: "recurring",
      recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    };
    const registered = await page.request.post("http://127.0.0.1:12119/_register", {
      data: {
        subscription: {
          id: subscriptionId,
          object: "subscription",
          customer: customerId,
          status: "active",
          created: 1_700_000_000,
          metadata: { studioId },
          latest_invoice: invoiceId,
          items: {
            object: "list",
            data: [{ id: `si_${tag}`, object: "subscription_item", quantity: 1, price }],
          },
        },
        invoice: { id: invoiceId, object: "invoice", customer: customerId, status: "open" },
      },
    });
    expect(registered.status()).toBe(204);

    const event = {
      id: eventId,
      object: "event",
      type: "invoice.payment_failed",
      created: 1_700_000_100,
      data: {
        object: {
          id: invoiceId,
          object: "invoice",
          customer: customerId,
          currency: "pln",
          amount_paid: 0,
          parent: { subscription_details: { subscription: subscriptionId } },
        },
      },
    };
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const response = await page.request.post("/api/stripe/webhook", {
      headers: { "stripe-signature": signature, "content-type": "application/json" },
      data: payload,
    });
    const webhookBody = await response.text();
    expect(response.status(), webhookBody).toBe(200);
    const updated = await one<{ status: string; plan: string }>(`SELECT status::text, plan::text FROM "Studio" WHERE id = $1`, [studioId]);
    expect(updated.status).toBe("past_due");
    expect(updated.plan).toBe("studio");

    await page.goto("/admin/login?next=/admin/subscriptions");
    await page.getByLabel("E-mail").fill(platformOperator.email);
    await page.getByLabel("Hasło").fill(platformOperator.password);
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    const arrears = page.locator("article").filter({ has: page.getByRole("heading", { name: "Zaległości" }) });
    await expect(arrears.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  } finally {
    await exec(`DELETE FROM "AuditLog" WHERE "studioId" = $1`, [studioId]);
    await exec(`DELETE FROM "StripeEvent" WHERE id = $1`, [eventId]);
    await exec(`DELETE FROM "Studio" WHERE id = $1`, [studioId]);
  }
});
