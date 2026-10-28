import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { studioOwner } from "./accounts";

test("@smoke sesja studia", async ({ page }) => {
  await mkdir("e2e/.auth", { recursive: true });
  await page.goto("/login?next=/");
  await page.getByLabel("E-mail").fill(studioOwner.email);
  await page.getByLabel("Hasło").fill(studioOwner.password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByRole("heading", { name: "Dzień dobry, Michał." })).toBeVisible();
  await page.context().storageState({ path: "e2e/.auth/studio.json" });
});
