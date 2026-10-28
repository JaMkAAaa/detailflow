import { randomBytes, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { exec } from "./db";

test("@smoke strona 2 listy klientów ma 20 wierszy i nie miesza tenantów", async ({ page }) => {
  const tag = randomBytes(4).toString("hex");
  const studioId = randomUUID();
  const clientId = randomUUID();
  const name = "E2E Obcy Najemca";
  const plate = `E2E ${tag}`;
  await exec(
    `INSERT INTO "Studio" (id, "publicCode", slug, name, "ksefEnv", "updatedAt") VALUES ($1, $2, $3, 'E2E Obce Studio', 'test', NOW())`,
    [studioId, `E2E${tag}`, `e2e-leak-${tag}`],
  );
  try {
    await exec(`INSERT INTO "Client" (id, "studioId", name, phone) VALUES ($1, $2, $3, '+48 700 999 001')`, [clientId, studioId, name]);
    await exec(
      `INSERT INTO "Vehicle" (id, "studioId", "clientId", make, model, plate) VALUES ($1, $2, $3, 'Beta', 'Leak', $4)`,
      [randomUUID(), studioId, clientId, plate],
    );

    await page.goto("/customers?page=2");
    await expect(page.getByRole("caption")).toHaveText("Klienci studia, strona 2 z 7");
    await expect(page.getByRole("table").locator("tbody tr").filter({ has: page.getByRole("link") })).toHaveCount(20);
    await expect(page.getByRole("table")).not.toContainText(name);
    await expect(page.getByRole("table")).not.toContainText(plate);

    await page.goto(`/customers?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("heading", { name: `Nie znaleziono „${name}”` })).toBeVisible();
  } finally {
    await exec(`DELETE FROM "Studio" WHERE id = $1`, [studioId]);
  }
});
