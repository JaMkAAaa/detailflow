import { expect, test } from "@playwright/test";
import { studioOwner } from "./accounts";

test("@smoke zespół pokazuje właściciela i zachowuje formularz zaproszeń", async ({ page }) => {
  await page.goto("/team");
  await expect(page.getByRole("heading", { name: "Zespół studia" })).toBeVisible();
  const owner = page.getByRole("listitem").filter({ hasText: studioOwner.email });
  await expect(owner).toContainText("Właściciel");
  await expect(owner.getByRole("button", { name: "Usuń dostęp" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Oczekujące zaproszenia" })).toBeVisible();
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Wyślij zaproszenie" })).toBeEnabled();
});
