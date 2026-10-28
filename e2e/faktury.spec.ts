import { expect, test } from "@playwright/test";
import { one } from "./db";

test("@smoke faktura nie powstaje z otwartego zlecenia DF-0248", async ({ page }) => {
  const studio = await one<{ id: string }>(`SELECT id FROM "Studio" WHERE slug = 'obsidian-studio'`);
  const openOrder = await one<{ id: string }>(`SELECT id FROM "WorkOrder" WHERE "studioId" = $1 AND number = 'DF-0248'`, [studio.id]);
  const before = await one<{ count: string }>(`SELECT count(*)::text AS count FROM "Invoice" WHERE "studioId" = $1 AND "workOrderId" = $2`, [studio.id, openOrder.id]);

  await page.goto("/invoices/new");
  const source = page.getByLabel("Zakończone zlecenie");
  await expect(source).toBeVisible();
  await expect(source).toContainText("DF-0243");
  await expect(source).not.toContainText("DF-0248");

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
