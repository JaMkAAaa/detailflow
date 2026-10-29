// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { InvoicesScreen } from "./InvoicesScreen";
import { InvoiceAttention } from "./InvoiceAttention";
import { isOverdue, isUnpaid, sumInvoices, type InvoiceRow } from "./list-model";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const now = "2026-10-24T10:00:00Z";
const base: InvoiceRow = { id: "a", number: "FV/41/10/2026", kind: "invoice", env: "test", status: "issued", ksefStatus: "accepted", buyerName: "Adam Nowak", buyerNip: null, orderNumber: "DF-0243", phone: null, issuedAt: now, dueAt: "2026-10-23T21:59:59Z", paidAt: null, totalGross: "4800.10", totalVat: "897.58", ksefNumber: "full-ksef-number", events: [] };
const rows: InvoiceRow[] = [base, { ...base, id: "b", number: "FV/39/10/2026", buyerName: "Auto Serwis Kowal", buyerNip: "123-456-78-0", phone: "+48123456789", ksefStatus: "rejected", ksefNumber: null, events: [{ kind: "rejected", message: "Nieprawidłowy NIP nabywcy", ref: "ref-test", attempt: 1, at: now }] }, { ...base, id: "c", number: "FV/38/10/2026", buyerName: "Anna Wiśniewska", ksefStatus: "retrying", ksefNumber: null, events: [{ kind: "retry_scheduled", message: "Ponawiamy · próba 3 z 8", ref: null, attempt: 3, at: now }] }];
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("searches names and unformatted NIP, combines filters and clears no-results", async () => {
  const user = userEvent.setup(); render(<InvoicesScreen studioId="studio-a" invoices={rows} env="test" now={now} />);
  const search = screen.getByRole("searchbox");
  await user.type(search, "123456780");
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("link", { name: "FV/39/10/2026" }).getAttribute("href")).toContain("?env=test");
  await user.clear(search); await user.type(search, "wisniewska");
  expect(within(screen.getByRole("table")).getByText("Anna Wiśniewska")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Przyjęte 1" }));
  expect(screen.getByRole("heading", { name: /Nie znaleziono/ })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
});
it("paginates seven rows and resets the page after filtering", async () => {
  const user = userEvent.setup();
  render(<InvoicesScreen studioId="studio-a" invoices={Array.from({ length: 8 }, (_, i) => ({ ...base, id: String(i), number: `FV/${i}/10/2026` }))} env="test" now={now} />);
  expect(screen.queryByRole("link", { name: "FV/7/10/2026" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "Następna strona" }));
  expect(screen.getByRole("link", { name: "FV/7/10/2026" })).toBeTruthy();
  await user.type(screen.getByRole("searchbox"), "FV/0/");
  expect(screen.getByRole("link", { name: "FV/0/10/2026" })).toBeTruthy();
});
it("separates unpaid amber from rejected red and shows only PROD labels in production", () => {
  render(<InvoicesScreen studioId="studio-a" invoices={rows.map(row => ({ ...row, env: "production" }))} env="production" now={now} />);
  expect(screen.queryByText(/TEST/)).toBeNull();
  expect(screen.getByText("Przyjęta").className).toContain("text-df-green");
  expect(screen.getByText("Odrzucona").className).toContain("text-df-error");
  expect(screen.getByText("Po terminie", { selector: "span" }).className).toContain("text-df-amber");
});
it("uses PLN Decimal sums and treats the Warsaw due day as payable until the end of day", () => {
  expect(sumInvoices([{ ...base, totalGross: "0.10" }, { ...base, totalGross: "0.20" }])).toBe("0.30");
  expect(isOverdue({ ...base, dueAt: "2026-10-24T00:00:00Z" }, now)).toBe(false);
  expect(isOverdue(base, now)).toBe(true);
  expect(isOverdue({ ...base, paidAt: now }, now)).toBe(false);
  expect(isOverdue(rows[1]!, now)).toBe(false);
});
it("queues a real retry and reports its result at the invoice row", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const user = userEvent.setup(); render(<InvoiceAttention studioId="studio-a" invoices={rows} env="test" now={now} />);
  expect(screen.getByText("Nieprawidłowy NIP nabywcy", { selector: "h3" })).toBeTruthy();
  expect(screen.getByText(/ref: ref-test/)).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Zaległe płatności" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Zadzwoń do klienta" }).getAttribute("href")).toBe("tel:+48123456789");
  expect((screen.getByRole("button", { name: "Offline · poza zakresem v1" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("button", { name: "Ponów teraz" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Potwierdź ponowienie" }));
  expect(screen.getByRole("status").textContent).toContain("Faktura jest w kolejce KSeF");
  expect(fetch).toHaveBeenCalledWith("/api/studios/studio-a/invoices/c/ksef/retry", expect.objectContaining({ method: "POST", body: "{}" }));
  expect(screen.getByRole("article", { name: /FV\/38/ })).toBeTruthy();
});
it("never counts a correction as an unpaid invoice", () => {
  const correction: InvoiceRow = { ...base, id: "k", number: "KFV/1/10/2026", kind: "correction", totalGross: "-1170.00" };
  expect(isUnpaid(base)).toBe(true); expect(isUnpaid(correction)).toBe(false); expect(isOverdue(correction, "2026-11-30T10:00:00Z")).toBe(false);
});

it("shows a safe refusal at the row and validates the NIP checksum before sending", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "raw-MF-token-secret" }) }));
  const user = userEvent.setup(); render(<InvoiceAttention studioId="studio-a" invoices={rows} env="test" now={now} />);
  await user.click(screen.getByRole("button", { name: "Popraw NIP i wyślij ponownie" }));
  const nip = screen.getByRole("textbox", { name: "NIP nabywcy" });
  await user.clear(nip); await user.type(nip, "5260250275");
  expect((screen.getByRole("button", { name: "Potwierdź ponowienie" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetch).not.toHaveBeenCalled();
  await user.clear(nip); await user.type(nip, "5260250274");
  await user.click(screen.getByRole("button", { name: "Potwierdź ponowienie" }));
  expect(within(screen.getByRole("article", { name: /FV\/39/ })).getByRole("status").textContent).toContain("Odmowa ponowienia");
  expect(screen.queryByText(/raw-MF-token-secret/)).toBeNull();
});
it("queues retry from the invoice list and displays the outcome in the same row", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  const user = userEvent.setup(); render(<InvoicesScreen studioId="studio-a" invoices={rows} env="test" now={now} />);
  const row = screen.getByRole("link", { name: "FV/39/10/2026" }).closest("tr")!;
  await user.click(within(row).getByRole("button", { name: "Ponów wysyłkę" }));
  expect(within(row).getByRole("status").textContent).toContain("Faktura jest w kolejce KSeF");
  expect(fetch).toHaveBeenCalledWith("/api/studios/studio-a/invoices/b/ksef/retry", expect.objectContaining({ body: "{}" }));
});
