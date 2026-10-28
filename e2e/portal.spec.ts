import { expect, test } from "@playwright/test";
import { expiredPortalToken, portalToken } from "./accounts";

test("@smoke portal pokazuje 3 etapy, a wygasły token kończy się ekranem P-02", async ({ page }) => {
  const active = await page.goto(`/p/${portalToken}`);
  expect(active?.status()).toBe(200);
  const stages = page.getByRole("list", { name: "Etapy zlecenia" }).getByRole("listitem");
  await expect(stages).toHaveCount(3);
  await expect(stages.nth(1)).toHaveAttribute("aria-current", "step");
  await expect(stages.nth(1)).toContainText("Korekta lakieru");
  await expect(stages.nth(2)).toContainText("Ceramika i kontrola");
  await expect(page.getByRole("region", { name: "Wycena" })).toContainText("4 800 zł");

  const expired = await page.goto(`/p/${expiredPortalToken}`);
  expect(expired?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Ten link już wygasł" })).toBeVisible();
  await expect(page.getByText("Porsche")).toHaveCount(0);
  await expect(page.getByText("DF-0248")).toHaveCount(0);
});
