import { expect, test } from "@playwright/test";
import { many, one } from "./db";

test("@smoke faktura nie powstaje z otwartego zlecenia DF-0248", async ({ page }) => {
  const studio = await one<{ id: string }>(`SELECT id FROM "Studio" WHERE slug = 'obsidian-studio'`);
  const openOrder = await one<{ id: string }>(`SELECT id FROM "WorkOrder" WHERE "studioId" = $1 AND number = 'DF-0248'`, [studio.id]);
  const before = await one<{ count: string }>(`SELECT count(*)::text AS count FROM "Invoice" WHERE "studioId" = $1 AND "workOrderId" = $2`, [studio.id, openOrder.id]);

  await page.goto("/invoices/new");
  const source = page.getByLabel("Zakończone zlecenie");
  await expect(source).toBeVisible();
  await expect(source).not.toContainText("DF-0243");
  await expect(source).not.toContainText("DF-0248");
  const eligible = await many<{ id: string }>(`
    SELECT w.id FROM "WorkOrder" w
    WHERE w."studioId" = $1 AND w.status = 'completed' AND w."completedAt" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "Invoice" i WHERE i."studioId" = w."studioId" AND i."workOrderId" = w.id
          AND i."ksefEnv" = (SELECT "ksefEnv" FROM "Studio" WHERE id = $1)
          AND i.kind = 'invoice' AND i.status <> 'canceled'
      )
    ORDER BY w."completedAt" DESC
  `, [studio.id]);
  expect(eligible.length).toBeGreaterThan(0);
  await expect(source.locator("option")).toHaveCount(eligible.length);
  expect(await source.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value))).toEqual(eligible.map(order => order.id));
  await expect(source).toHaveValue(eligible[0]!.id);

  const response = await page.request.post(`/api/studios/${studio.id}/invoices`, {
    headers: { origin: "http://127.0.0.1:3100" },
    data: {
      workOrderId: openOrder.id,
      buyer: { name: "Adam Nowak", street: "ul. Puławska 120/4", postal: "02-620", city: "Warszawa" },
      items: [{ name: "Korekta lakieru", quantity: "1", unitNet: "3902.44", vatRate: 23 }],
      dueDays: 7,
    },
  });
  expect(response.status()).toBe(409);
  const body = (await response.json()) as { error?: string };
  expect(body.error ?? "").toContain("#DF-0248");
  const after = await one<{ count: string }>(`SELECT count(*)::text AS count FROM "Invoice" WHERE "studioId" = $1 AND "workOrderId" = $2`, [studio.id, openOrder.id]);
  expect(after.count).toBe(before.count);

  const fv = await one<{ number: string }>(
    `SELECT w.number FROM "Invoice" i JOIN "WorkOrder" w ON w.id = i."workOrderId" WHERE i."studioId" = $1 AND i.number = 'FV/41/10/2026'`,
    [studio.id],
  );
  expect(fv.number).toBe("DF-0243");
});
