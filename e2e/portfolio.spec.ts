import { expect, test } from "@playwright/test";

test("@smoke portfolio: puste studio nie jest 404, menu prowadzi do listy, gość nie widzi danych seeda", async ({ page, browser }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Portfolio realizacji" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Brak potwierdzonych zdjęć");
  const sidebar = page.getByRole("navigation", { name: "Nawigacja studia" });
  await expect(sidebar.getByRole("link", { name: "Portfolio" })).toHaveAttribute("href", "/portfolio");
  await expect(sidebar.getByRole("button", { name: /Portfolio/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/more");
  await page.getByRole("link", { name: "Portfolio" }).click();
  await expect(page).toHaveURL(/\/portfolio$/);

  const guest = await browser.newContext();
  try {
    const publicPage = await guest.newPage();
    const response = await publicPage.goto("/realizacje/obsidian-studio");
    expect(response?.status()).toBe(200);
    await expect(publicPage.getByRole("heading", { name: "Obsidian Studio" })).toBeVisible();
    await expect(publicPage.getByRole("status")).toContainText("nie opublikowało jeszcze realizacji");
    const text = await publicPage.locator("body").innerText();
    for (const secret of ["Adam Nowak", "WA 911PC", "adam.nowak@example.com", "+48 600 123 456", "9512345678", "Rzemieślnicza", "+48 600 100 128", "Michał Kowalski", "X-Amz-"]) {
      expect(text).not.toContain(secret);
    }
    expect((await publicPage.goto("/realizacje/brak-takiego-studia"))?.status()).toBe(404);
  } finally {
    await guest.close();
  }
});
