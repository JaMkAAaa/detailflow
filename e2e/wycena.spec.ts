import { expect, test } from "@playwright/test";

test("@smoke wycena 4 000 × 1,2 × 1,0 daje 4 800 zł i VAT 897,56", async ({ page }) => {
  await page.goto("/quotes/new");
  await expect(page.getByRole("heading", { name: "Nowa wycena" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Średnie/ })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Stan lakieru" })).toHaveAttribute("data-value", "standard");

  const summary = page.getByRole("complementary", { name: "Podsumowanie" });
  await expect(summary.getByText("4 000 zł")).toBeVisible();
  await expect(summary.getByText("× 1,20")).toBeVisible();
  await expect(summary.getByText("× 1,00")).toBeVisible();
  await expect(summary.getByLabel("Kwota brutto")).toHaveText("4 800 zł");
  await expect(summary.getByText("Brutto, w tym VAT 23%: 897,56 zł")).toBeVisible();
});
