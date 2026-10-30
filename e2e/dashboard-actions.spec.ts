import { expect, test } from "@playwright/test";

test("@smoke pulpit i mobilny plus otwierają wspólny formularz zlecenia", async ({ page }) => {
  await page.goto("/");
  const desktop = page.locator("main .hidden.lg\\:block");
  await desktop.getByRole("link", { name: "+ Nowe zlecenie" }).click();
  await expect(page.getByRole("dialog", { name: "Nowe zlecenie" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Klient", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();
  await expect(page.getByRole("dialog", { name: "Nowe zlecenie" })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Powiadomienia", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Powiadomienia" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("navigation", { name: "Nawigacja mobilna" }).getByRole("link", { name: "Nowe zlecenie", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByRole("heading", { name: "Nowe zlecenie" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Utwórz zlecenie" })).toBeEnabled();
});
