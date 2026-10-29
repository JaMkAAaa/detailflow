import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ksefJobId, ksefQueue } from "../src/ksef/queue";
import { studioOwner } from "./accounts";
import { exec, one } from "./db";

test("@smoke nowe zlecenie → zakończenie → faktura → kolejka KSeF TEST", async ({ page }) => {
  const studioId = randomUUID();
  const clientId = randomUUID();
  const vehicleId = randomUUID();
  const owner = await one<{ id: string }>(`SELECT id FROM "User" WHERE email = $1`, [studioOwner.email]);
  const protectedOrder = await one<{ count: string }>(
    `SELECT count(*)::text AS count FROM "Invoice" i JOIN "WorkOrder" w ON w.id = i."workOrderId" AND w."studioId" = i."studioId"
     JOIN "Studio" s ON s.id = w."studioId" WHERE s.slug = 'obsidian-studio' AND w.number = 'DF-0248'`,
  );
  const queue = ksefQueue();
  let invoiceId: string | undefined;

  // Independent tenant: no changes to the seed's orders, counters or KSeF credentials.
  await exec(
    `INSERT INTO "Studio" (id, "publicCode", slug, name, status, nip, address, postal, city, "ksefEnv", "updatedAt")
     VALUES ($1, $1, $1, 'E2E Obieg faktury', 'active', '9512345678', 'Rzemieślnicza 12', '02-675', 'Warszawa', 'test', NOW())`,
    [studioId],
  );
  try {
    await exec(`INSERT INTO "Membership" (id, "studioId", "userId", role) VALUES ($1, $2, $3, 'owner')`, [randomUUID(), studioId, owner.id]);
    await exec(
      `INSERT INTO "Client" (id, "studioId", name, email, street, postal, city)
       VALUES ($1, $2, 'E2E Nabywca', 'invoice@example.test', 'Testowa 1', '00-001', 'Warszawa')`,
      [clientId, studioId],
    );
    await exec(
      `INSERT INTO "Vehicle" (id, "studioId", "clientId", make, model, plate) VALUES ($1, $2, $3, 'E2E', 'Auto', 'E2E TEST')`,
      [vehicleId, studioId, clientId],
    );
    const headers = { origin: "http://127.0.0.1:3100" };
    const selected = await page.request.post("/api/studios/active", { headers, data: { studioId } });
    expect(selected.status()).toBe(200);
    const token = await page.request.put(`/api/studios/${studioId}/ksef/token`, {
      headers, data: { token: "e2e-placeholder-never-valid-at-mf" },
    });
    expect(token.status()).toBe(204);

    await page.goto("/orders");
    await page.getByRole("button", { name: "＋ Nowe zlecenie", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Nowe zlecenie" });
    await dialog.getByLabel("Klient", { exact: true }).selectOption(clientId);
    await dialog.getByLabel("Auto", { exact: true }).selectOption(vehicleId);
    await dialog.getByLabel("Kwota brutto", { exact: true }).fill("123.00");
    const created = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/studios/${studioId}/orders`));
    await dialog.getByRole("button", { name: "Utwórz zlecenie" }).click();
    const createdResponse = await created;
    expect(createdResponse.status()).toBe(201);
    const order = await createdResponse.json() as { id: string; number: string; status: string };
    expect(order.number).toMatch(/^DF-\d{4,}$/);
    expect(order.number).not.toBe("DF-0248");
    expect(order.status).toBe("accepted");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(order.number) })).toBeVisible();

    // Status transitions use the real authenticated API; stage completion uses the detail UI.
    const started = await page.request.post(`/api/studios/${studioId}/orders/${order.id}/status`, { headers, data: { status: "in_progress" } });
    expect(started.status()).toBe(200);
    await page.goto(`/orders/${order.number}`);
    for (const stage of ["Przyjęcie i mycie", "Korekta lakieru", "Aplikacja ceramiki"]) {
      const advanced = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/orders/${order.id}/advance`));
      await page.getByRole("button", { name: `Zakończ: ${stage}`, exact: true }).click();
      expect((await advanced).status()).toBe(200);
    }
    await expect(page.getByRole("button", { name: /^Zakończ:/ })).toHaveCount(0);
    const completed = await page.request.post(`/api/studios/${studioId}/orders/${order.id}/status`, { headers, data: { status: "completed" } });
    expect(completed.status()).toBe(200);
    const savedOrder = await one<{ status: string; stage: number; completedAt: Date | null }>(
      `SELECT status::text, stage, "completedAt" FROM "WorkOrder" WHERE id = $1 AND "studioId" = $2`, [order.id, studioId],
    );
    expect(savedOrder).toMatchObject({ status: "completed", stage: 4 });
    expect(savedOrder.completedAt).not.toBeNull();

    await page.goto("/invoices/new");
    await page.getByLabel("Zakończone zlecenie").selectOption(order.id);
    await expect(page.getByLabel("Imię i nazwisko", { exact: true })).toHaveValue("E2E Nabywca");
    await page.getByRole("button", { name: "Dalej: pozycje →", exact: true }).click();
    await page.getByRole("button", { name: "Dalej: podgląd →", exact: true }).click();
    await expect(page.getByRole("button", { name: /\(demo\)/ })).toHaveCount(0);
    await page.getByRole("checkbox", { name: "Sprawdziłem nabywcę, pozycje i kwoty VAT." }).check();
    const issued = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/studios/${studioId}/invoices`));
    await page.getByRole("button", { name: "Wystaw fakturę", exact: true }).click();
    const issuedResponse = await issued;
    expect(issuedResponse.status()).toBe(201);
    const invoice = await issuedResponse.json() as { id: string; number: string; ksefEnv: string };
    invoiceId = invoice.id;
    expect(invoice.number).toMatch(/^FV\//);
    expect(invoice.ksefEnv).toBe("test");
    await expect(page.getByRole("heading", { name: invoice.number, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wyślij do KSeF", exact: true })).toBeVisible();
    const queued = page.waitForResponse(response => response.request().method() === "POST" && response.url().endsWith(`/invoices/${invoice.id}/ksef`));
    await page.getByRole("button", { name: "Wyślij do KSeF", exact: true }).click();
    const queuedResponse = await queued;
    expect(queuedResponse.status()).toBe(202);
    expect(await queuedResponse.json()).toEqual({ ksefStatus: "queued" });
    await page.reload();
    await expect(page.getByText("W kolejce", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("list", { name: "Historia zdarzeń" })).toContainText("Walidacja XSD FA(3) OK · KSeF TEST");
    const saved = await one<{ ksefStatus: string; workOrderId: string; xml: string }>(
      `SELECT i."ksefStatus"::text, i."workOrderId", s.xml FROM "Invoice" i
       JOIN "KsefSubmission" s ON s."invoiceId" = i.id AND s."studioId" = i."studioId" WHERE i.id = $1 AND i."studioId" = $2`,
      [invoice.id, studioId],
    );
    expect(saved.ksefStatus).toBe("queued");
    expect(saved.workOrderId).toBe(order.id);
    expect(saved.xml).toContain(invoice.number);
    expect(saved.xml).toContain("<P_15>123.00</P_15>");
    const job = await queue.getJob(ksefJobId({ studioId, invoiceId: invoice.id }));
    expect(job?.data).toEqual({ studioId, invoiceId: invoice.id });
    expect(await job?.getState()).toBe("waiting");
    const after = await one<{ count: string }>(
      `SELECT count(*)::text AS count FROM "Invoice" i JOIN "WorkOrder" w ON w.id = i."workOrderId" AND w."studioId" = i."studioId"
       JOIN "Studio" s ON s.id = w."studioId" WHERE s.slug = 'obsidian-studio' AND w.number = 'DF-0248'`,
    );
    expect(after.count).toBe(protectedOrder.count);
    expect(after.count).toBe("0");
  } finally {
    try {
      if (invoiceId) await (await queue.getJob(ksefJobId({ studioId, invoiceId })))?.remove();
    } finally {
      await queue.close();
      await exec(`DELETE FROM "AuditLog" WHERE "studioId" = $1`, [studioId]);
      await exec(`DELETE FROM "Studio" WHERE id = $1`, [studioId]);
    }
  }
});
