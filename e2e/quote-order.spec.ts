import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { studioOwner } from "./accounts";
import { exec, one } from "./db";

test("@smoke zaakceptowana wycena → wybór terminu i boksu → jedno zlecenie", async ({ page }) => {
  const studioId = randomUUID(), clientId = randomUUID(), vehicleId = randomUUID(), quoteId = randomUUID(), bayId = randomUUID();
  const owner = await one<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [studioOwner.email]);
  const headers = { origin: "http://127.0.0.1:3100" };
  await exec(`INSERT INTO "Studio" (id, "publicCode", slug, name, status, "updatedAt") VALUES ($1, $1, $1, 'E2E Wycena', 'active', NOW())`, [studioId]);
  try {
    await exec(`INSERT INTO "Membership" (id, "studioId", "userId", role) VALUES ($1, $2, $3, 'owner')`, [randomUUID(), studioId, owner.id]);
    await exec(`INSERT INTO "Client" (id, "studioId", name, email) VALUES ($1, $2, 'E2E Klient wyceny', 'quote@example.test')`, [clientId, studioId]);
    await exec(`INSERT INTO "Vehicle" (id, "studioId", "clientId", make, model, plate) VALUES ($1, $2, $3, 'Fiat', 'Panda', 'E2E QUOTE')`, [vehicleId, studioId, clientId]);
    await exec(`INSERT INTO "Bay" (id, "studioId", name, sort) VALUES ($1, $2, 'Boks wyceny', 0)`, [bayId, studioId]);
    expect((await page.request.post("/api/studios/active", { headers, data: { studioId } })).status()).toBe(200);
    const saved = await page.request.put(`/api/studios/${studioId}/quotes/${quoteId}`, { headers, data: {
      clientId, vehicleId, size: "medium", paintMult: "1.00", notes: "", slotId: "oct24",
      items: [{ name: "Korekta", basePrice: "100.01", durationMin: 60 }, { name: "Mycie", basePrice: "10.00", durationMin: 30 }],
    } });
    expect(saved.status()).toBe(200);
    expect((await page.request.post(`/api/studios/${studioId}/quotes/${quoteId}/send`, { headers })).status()).toBe(202);
    const link = await page.request.post(`/api/studios/${studioId}/portal-links`, { headers, data: { quoteId } });
    expect(link.status()).toBe(201);
    const { path } = await link.json() as { path: string };
    const decision = await page.request.post(`${path}/decision`, { headers, form: { decision: "accepted" }, maxRedirects: 0 });
    expect(decision.status()).toBe(303);
    await page.goto(path);
    await expect(page.getByText("Decyzja została zapisana", { exact: false })).toBeVisible();
    const count = () => one<{ count: string }>(`SELECT count(*)::text AS count FROM "WorkOrder" WHERE "studioId" = $1 AND "quoteId" = $2`, [studioId, quoteId]);
    expect((await count()).count).toBe("0");
    await page.goto("/quotes/new");
    await page.getByRole("link", { name: "Wszystkie wyceny" }).click();
    await page.getByRole("link", { name: /E2E Klient wyceny/ }).click();
    await expect(page.getByText("Zaakceptowana", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Utwórz zlecenie", exact: true }).click();
    await expect(page.getByLabel("Klient", { exact: true })).toHaveValue(clientId);
    await expect(page.getByLabel("Auto", { exact: true })).toHaveValue(vehicleId);
    await expect(page.getByLabel("Usługa", { exact: true })).toHaveValue("Korekta, Mycie");
    await expect(page.getByLabel("Kwota brutto", { exact: true })).toHaveValue("132.01");
    for (const label of ["Termin od", "Termin do", "Boks"]) await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
    await page.getByLabel("Termin od", { exact: true }).fill("2026-11-02T10:00");
    await page.getByLabel("Termin do", { exact: true }).fill("2026-11-02T12:00");
    await page.getByLabel("Boks", { exact: true }).selectOption(bayId);
    const created = page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith(`/quotes/${quoteId}/order`));
    await page.locator("form").getByRole("button", { name: "Utwórz zlecenie", exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(200);
    const order = await response.json() as { number: string; totalGross: string; bayId: string };
    expect(order).toMatchObject({ totalGross: "132.01", bayId });
    await expect(page).toHaveURL(new RegExp(`/orders/${order.number}$`));
    await page.goto(`/quotes/${quoteId}`);
    await page.getByRole("link", { name: "Otwórz zlecenie", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${order.number}$`));
    expect((await count()).count).toBe("1");
  } finally {
    await exec(`DELETE FROM "WorkOrder" WHERE "studioId" = $1`, [studioId]);
    await exec(`DELETE FROM "Studio" WHERE id = $1`, [studioId]);
  }
});
