import { expect, test } from "@playwright/test";

test("@smoke seed pokazuje 7 aktywnych zleceń i Porsche na etapie 2/4", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/sobota, 24 października 2026 · 2 aut/)).toBeVisible();

  const active = page
    .getByRole("region", { name: "Wskaźniki studia" })
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Aktywne zlecenia" }) });
  await expect(active.locator("p").first()).toHaveText("7");
  await expect(active).toContainText("3 w trakcie · 2 do odbioru · 2 przyjęte");

  const progress = page.getByRole("progressbar", { name: "Postęp zlecenia Porsche Panamera" });
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await expect(progress).toHaveAttribute("aria-valuemax", "4");
  await expect(progress).toHaveAttribute("aria-valuetext", /Etap 2 z 4/);
  await expect(page.getByRole("heading", { name: "Porsche Panamera" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Serwis ceramiki · 3 klientów" })).toBeVisible();
});
