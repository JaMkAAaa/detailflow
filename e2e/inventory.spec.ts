import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { studioOwner } from "./accounts";
import { exec, one } from "./db";

test("@smoke magazyn: rzeczywisty stan, korekta i alert pulpitu desktop/mobile", async ({ page }) => {
  const studioId = randomUUID();
  const owner = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [studioOwner.email]);
  await exec(`INSERT INTO "Studio" (id, "publicCode", slug, name, status, "updatedAt") VALUES ($1, $1, $1, 'E2E Magazyn', 'active', NOW())`, [studioId]);
  try {
    await exec(`INSERT INTO "Membership" (id, "studioId", "userId", role) VALUES ($1, $2, $3, 'owner')`, [randomUUID(), studioId, owner.id]);
    expect((await page.request.post("/api/studios/active", { headers: { origin: "http://127.0.0.1:3100" }, data: { studioId } })).status()).toBe(200);
    await page.goto("/inventory");
    await expect(page.getByText(/Brak chemii w magazynie/)).toBeVisible();
    await page.getByLabel("Nazwa", { exact: true }).fill("E2E Pasta");
    await page.getByLabel("Stan początkowy").fill("20");
    await page.getByLabel("Próg niskiego stanu").fill("20");
    await page.getByLabel("Powód wpisu / korekty").fill("Pomiar początkowy");
    await page.getByRole("button", { name: "Dodaj pozycję" }).click();
    await expect(page.getByRole("button", { name: "Korekta: E2E Pasta" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Niski stan", { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Niski stan chemii · E2E Pasta/ })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("link", { name: /Niski stan chemii · E2E Pasta/ })).toBeVisible();
    await page.getByRole("link", { name: /Niski stan chemii · E2E Pasta/ }).click();
    await page.getByRole("button", { name: "Korekta: E2E Pasta" }).click();
    await page.getByLabel("Nowy stan").fill("21");
    await page.getByLabel("Powód wpisu / korekty").fill("Dostawa");
    await page.getByRole("button", { name: "Zapisz korektę" }).click();
    await expect(page.getByText("Ostatni powód: Dostawa")).toBeVisible();
    await expect(page.getByText("Niski stan", { exact: true })).toHaveCount(0);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Niski stan chemii/ })).toHaveCount(0);
    const row = await one<{ quantity: number; version: number }>('SELECT quantity, version FROM "Chemical" WHERE "studioId" = $1', [studioId]);
    expect(row).toEqual({ quantity: 21, version: 1 });
  } finally {
    await exec('DELETE FROM "Studio" WHERE id = $1', [studioId]);
  }
});
