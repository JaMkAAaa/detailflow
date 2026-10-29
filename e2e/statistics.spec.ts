import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { studioOwner } from "./accounts";
import { exec, one } from "./db";

const headers = { origin: "http://127.0.0.1:3100" };

test("@smoke statystyki studia: przychód, udział usług, obłożenie, brak danych i dostęp tylko właściciela", async ({ page }) => {
  const studioId = randomUUID(), otherStudioId = randomUUID(), clientId = randomUUID(), vehicleId = randomUUID(), bayId = randomUUID(), otherClientId = randomUUID(), otherVehicleId = randomUUID();
  const owner = await one<{ id: string }>('SELECT id FROM "User" WHERE email = $1', [studioOwner.email]);
  const insertStudio = (id: string, name: string) =>
    exec(`INSERT INTO "Studio" (id, "publicCode", slug, name, status, "updatedAt") VALUES ($1, $1, $1, $2, 'active', NOW())`, [id, name]);
  const insertOrder = (studio: string, client: string, vehicle: string, number: string, status: string, service: string, gross: string, from: string, to: string, completedAt: string | null, bay: string | null) =>
    exec(
      `INSERT INTO "WorkOrder" (id, "studioId", number, "clientId", "vehicleId", "bayId", status, service, "scheduledFrom", "scheduledTo", "completedAt", "totalGross", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::"OrderStatus", $8, $9, $10, $11, $12, NOW())`,
      [randomUUID(), studio, number, client, vehicle, bay, status, service, from, to, completedAt, gross],
    );
  await insertStudio(studioId, "E2E Statystyki");
  await insertStudio(otherStudioId, "E2E Statystyki obce");
  try {
    await exec(`INSERT INTO "Membership" (id, "studioId", "userId", role) VALUES ($1, $2, $3, 'owner')`, [randomUUID(), studioId, owner.id]);
    await exec(`INSERT INTO "Membership" (id, "studioId", "userId", role) VALUES ($1, $2, $3, 'manager')`, [randomUUID(), otherStudioId, owner.id]);
    for (const [studio, client, vehicle] of [[studioId, clientId, vehicleId], [otherStudioId, otherClientId, otherVehicleId]] as const) {
      await exec(`INSERT INTO "Client" (id, "studioId", name) VALUES ($1, $2, 'E2E Klient statystyk')`, [client, studio]);
      await exec(`INSERT INTO "Vehicle" (id, "studioId", "clientId", make, model, plate) VALUES ($1, $2, $3, 'Fiat', 'Panda', $4)`, [vehicle, studio, client, `E2E ${vehicle.slice(0, 6)}`]);
    }
    await exec(`INSERT INTO "Bay" (id, "studioId", name, sort) VALUES ($1, $2, 'Boks statystyk', 1)`, [bayId, studioId]);
    // Wrzesień (CEST): 10.09 08–16 Warsaw. Sierpień celowo bez zleceń. Październik: zakończone, anulowane i aktywne.
    await insertOrder(studioId, clientId, vehicleId, "ST-1", "completed", "Ceramika", "1000.10", "2026-09-10T06:00:00Z", "2026-09-10T14:00:00Z", "2026-09-10T14:00:00Z", bayId);
    await insertOrder(studioId, clientId, vehicleId, "ST-2", "completed", "Mycie", "0.20", "2026-09-11T06:00:00Z", "2026-09-11T07:00:00Z", "2026-09-30T21:59:59Z", null);
    await insertOrder(studioId, clientId, vehicleId, "ST-3", "completed", "Ceramika", "99.90", "2026-10-02T06:00:00Z", "2026-10-02T07:00:00Z", "2026-10-02T07:00:00Z", null);
    await insertOrder(studioId, clientId, vehicleId, "ST-4", "canceled", "Ceramika", "5000.00", "2026-10-06T06:00:00Z", "2026-10-06T14:00:00Z", null, bayId);
    await insertOrder(studioId, clientId, vehicleId, "ST-5", "in_progress", "Ceramika", "4000.00", "2026-10-05T06:00:00Z", "2026-10-05T14:00:00Z", null, bayId);
    // Obce studio: duże kwoty, które nie mogą się pojawić w statystykach właściciela.
    await insertOrder(otherStudioId, otherClientId, otherVehicleId, "OT-1", "completed", "Obca usługa", "77777.77", "2026-09-10T06:00:00Z", "2026-09-10T14:00:00Z", "2026-09-10T14:00:00Z", null);

    expect((await page.request.post("/api/studios/active", { headers, data: { studioId } })).status()).toBe(200);
    await page.goto("/statistics?from=2026-08-01&to=2026-10-31");
    await expect(page.getByRole("heading", { name: "Statystyki studia" })).toBeVisible();
    const kpis = page.getByRole("region", { name: "Wskaźniki" });
    // 1000,10 + 0,20 (wrzesień wg północy Warszawy) + 99,90; anulowane i aktywne nie wchodzą.
    await expect(kpis).toContainText("1 100,20 zł");
    await expect(kpis).toContainText("2,2%"); // 16 h z 736 h
    const months = page.getByRole("heading", { name: "Przychód wg miesięcy" }).locator("xpath=ancestor::section[1]");
    await expect(months.getByText("sierpień 2026").locator("xpath=ancestor::li[1]")).toContainText("Brak danych");
    await expect(months.getByText("wrzesień 2026").locator("xpath=ancestor::li[1]")).toContainText("1 000,30 zł");
    await expect(months.getByText("październik 2026").locator("xpath=ancestor::li[1]")).toContainText("99,90 zł");
    await expect(page.getByRole("heading", { name: "Udział usług" }).locator("xpath=ancestor::section[1]")).toContainText("66,7%");
    await expect(page.getByText("Boks statystyk", { exact: true })).toBeVisible();
    await expect(page.getByText(/77\s?777/)).toHaveCount(0);
    await expect(page.getByText("Obca usługa")).toHaveCount(0);

    // Menu: link zamiast „Wkrótce”.
    const sidebar = page.getByRole("navigation", { name: "Nawigacja studia" });
    await expect(sidebar.getByRole("link", { name: "Statystyki" })).toHaveAttribute("aria-current", "page");
    await expect(sidebar.getByRole("button", { name: /Statystyki/ })).toHaveCount(0);

    // API ma te same liczby.
    const api = await page.request.get(`/api/studios/${studioId}/statistics?from=2026-08-01&to=2026-10-31`);
    expect(api.status()).toBe(200);
    expect((await api.json()).revenue.totalPln).toBe("1100.20");
    expect((await page.request.get(`/api/studios/${otherStudioId}/statistics`)).status()).toBe(403);

    // Zakres bez zleceń: brak danych, nie zera.
    await page.goto("/statistics?from=2026-01-01&to=2026-01-31");
    await expect(kpis.getByText("Brak danych")).toHaveCount(3);
    await expect(kpis.getByText(/^0([,.]\d+)? zł$/)).toHaveCount(0);

    // Niepoprawny zakres: komunikat i bieżący miesiąc.
    await page.goto("/statistics?from=2026-02-30&to=2026-03-01");
    await expect(page.getByRole("alert").filter({ hasText: "Podaj daty" })).toContainText("Pokazano bieżący miesiąc");

    // Formularz zakresu.
    await page.getByLabel("Od").fill("2026-09-01");
    await page.getByLabel("Do").fill("2026-09-30");
    await page.getByRole("button", { name: "Pokaż" }).click();
    await expect(page).toHaveURL(/from=2026-09-01&to=2026-09-30/);
    await expect(kpis).toContainText("1 000,30 zł");

    // Mobile: Statystyki w „Więcej”, bez poziomego przewijania.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/statistics?from=2026-08-01&to=2026-10-31");
    await expect(kpis).toContainText("1 100,20 zł");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.goto("/more");
    await page.getByRole("link", { name: "Statystyki" }).click();
    await expect(page).toHaveURL(/\/statistics$/);

    // Manager nie ma widoku właściciela: brak linku, 404 i 403 w API.
    expect((await page.request.post("/api/studios/active", { headers, data: { studioId: otherStudioId } })).status()).toBe(200);
    await page.setViewportSize({ width: 1440, height: 900 });
    const denied = await page.goto("/statistics");
    expect(denied?.status()).toBe(404);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Nawigacja studia" }).getByRole("link", { name: "Statystyki" })).toHaveCount(0);
    expect((await page.request.get(`/api/studios/${otherStudioId}/statistics`)).status()).toBe(403);
  } finally {
    await exec('DELETE FROM "WorkOrder" WHERE "studioId" = ANY($1)', [[studioId, otherStudioId]]);
    await exec('DELETE FROM "Studio" WHERE id = ANY($1)', [[studioId, otherStudioId]]);
  }
});
