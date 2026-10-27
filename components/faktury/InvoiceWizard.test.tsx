// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { InvoiceWizard, invoiceDraftKey } from "./InvoiceWizard";
import { InvoiceDetails } from "./InvoiceDetails";
import { invoiceNumberFromSegment, invoiceHref, totals, validBuyer, type InvoiceView, type Order, type Seller } from "./model";
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const seller: Seller = { name: "Obsidian", nip: "9512345678", address: "Warszawska 1", postal: "00-001", city: "Warszawa", env: "test" };
const orders: Order[] = [{ id: "order", number: "DF-0243", vehicle: "BMW X3", completedAt: "2026-10-23T14:30:00Z", buyer: { name: "Adam Nowak", nip: "", street: "Puławska 120/4", postal: "02-620", city: "Warszawa", email: "adam@example.com" }, items: ["Korekta lakieru", "Powłoka ceramiczna"].map(name => ({ name, quantity: "1", unitNet: "1951.22", vatRate: 23, discount: "0" })) }];
const invoice: InvoiceView = { id: "invoice", number: "FV/41/10/2026", env: "test", status: "issued", ksefStatus: "accepted", ksefNumber: "demo-number", acceptedAt: "2026-10-24T08:13:08Z", issuedAt: "2026-10-24T08:12:08Z", saleAt: "2026-10-24T08:12:08Z", dueAt: "2026-10-31T12:00:00Z", paidAt: null, emailedAt: "2026-10-24T08:13:30Z", upoXml: null, kind: "invoice", correctsNumber: null, correctionReason: null, corrections: [], current: [], orderNumber: "DF-0243", buyer: orders[0]!.buyer, items: orders[0]!.items, totalNet: "3902.44", totalVat: "897.56", totalGross: "4800", events: [] };
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it("decodes invoice route segments and preserves the environment in links", () => {
  expect(invoiceNumberFromSegment("FV%2F41%2F10%2F2026")).toBe("FV/41/10/2026");
  expect(invoiceNumberFromSegment("FV/41/10/2026")).toBe("FV/41/10/2026");
  expect(invoiceNumberFromSegment("FV%ZZ")).toBeNull();
  expect(invoiceHref("FV/41/10/2026", "production")).toBe("/invoices/FV%2F41%2F10%2F2026?env=production");
});
it("uses Decimal line rounding and validates a company NIP", () => {
  const price = totals(orders[0]!.items);
  expect(price.net.toFixed(2)).toBe("3902.44"); expect(price.vat.toFixed(2)).toBe("897.56"); expect(price.gross.toFixed(2)).toBe("4800.00");
  expect(validBuyer({ ...orders[0]!.buyer, nip: "5260250274" }, true)).toBe(true);
  expect(validBuyer({ ...orders[0]!.buyer, nip: "1234567890" }, true)).toBe(false);
});
it("walks through buyer, editable order items and VAT preview, blocking invalid values", async () => {
  const user = userEvent.setup(); render(<InvoiceWizard studioId="a" userId="u" seller={seller} orders={orders} />);
  await user.click(await screen.findByRole("button", { name: /Dalej: pozycje/ }));
  expect(screen.getByText("4 800,00 zł")).toBeTruthy();
  const quantity = screen.getByLabelText("Ilość: Korekta lakieru"); await user.clear(quantity);
  expect((screen.getByRole("button", { name: /Dalej: podgląd/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(quantity, "2");
  await user.click(screen.getByRole("button", { name: /Dalej: podgląd/ }));
  expect(screen.getByRole("article", { name: "Podgląd faktury VAT" })).toBeTruthy();
  expect((screen.getByRole("button", { name: /Potwierdź wysyłkę/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("checkbox")); await user.click(screen.getByRole("button", { name: /Potwierdź wysyłkę/ }));
  expect(screen.getByText(/Nie wystawiono nowej faktury/)).toBeTruthy();
  expect(JSON.parse(localStorage.getItem(invoiceDraftKey("a", "u", "test"))!).items[0].quantity).toBe("2");
  expect(localStorage.getItem(invoiceDraftKey("b", "u", "test"))).toBeNull();
  expect(localStorage.getItem(invoiceDraftKey("a", "u", "production"))).toBeNull();
});
it("does not let an invalid buyer bypass step one and handles a corrupt draft", async () => {
  const user = userEvent.setup(); localStorage.setItem(invoiceDraftKey("a", "u", "test"), "broken");
  render(<InvoiceWizard studioId="a" userId="u" seller={seller} orders={orders} />);
  await user.click(await screen.findByRole("radio", { name: "Firma (NIP)" }));
  expect(screen.getByRole("alert").textContent).toContain("Nie udało się odczytać szkicu");
  expect((screen.getByRole("button", { name: /Pozycje i VAT/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.type(screen.getByLabelText("NIP"), "5260250274");
  expect((screen.getByRole("button", { name: /Dalej: pozycje/ }) as HTMLButtonElement).disabled).toBe(false);
});
it("labels PROD explicitly, exposes document controls, and saves the payment", async () => {
  const user = userEvent.setup(); router.refresh.mockClear();
  const calls = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => String(url).endsWith("/paid") ? reply({ paid: true, paidAt: "2026-10-27T10:00:00.000Z" }) : reply({ error: "Brak dokumentu" }, 409));
  render(<InvoiceDetails studioId="studio-test" invoice={{ ...invoice, env: "production" }} seller={seller} />);
  expect(screen.getByText("PROD")).toBeTruthy(); expect(screen.queryByText("Przyjęta (test)")).toBeNull();
  expect(screen.getByText("60 s")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /UPO/ })); expect(screen.getByRole("status").textContent).toContain("nie jest dostępne");
  await user.click(screen.getByRole("button", { name: "Pobierz PDF" })); expect(calls).toHaveBeenCalledWith(`/api/studios/studio-test/invoices/${invoice.id}/pdf?env=production`);
  await user.click(screen.getByRole("button", { name: "Oznacz jako opłaconą" }));
  await user.click(screen.getByRole("button", { name: "Potwierdź płatność" }));
  expect(calls).toHaveBeenCalledWith(`/api/studios/studio-test/invoices/${invoice.id}/paid`, expect.objectContaining({ method: "POST" }));
  expect(await screen.findByText("Opłacona")).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("jako opłaconą");
  expect((screen.getByRole("button", { name: "Oznacz jako opłaconą" }) as HTMLButtonElement).disabled).toBe(true);
  expect(router.refresh).toHaveBeenCalled();
});
it("shows the server error when the payment cannot be saved", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ error: "Faktura jest już oznaczona jako opłacona." }, 409));
  render(<InvoiceDetails studioId="studio-test" invoice={invoice} seller={seller} />);
  await user.click(screen.getByRole("button", { name: "Oznacz jako opłaconą" })); await user.click(screen.getByRole("button", { name: "Potwierdź płatność" }));
  expect((await screen.findByRole("alert")).textContent).toContain("już oznaczona");
  expect(screen.queryByText("Opłacona")).toBeNull();
});
it("sends only changed lines with the reason and opens the new correction", async () => {
  const user = userEvent.setup(); router.push.mockClear();
  const current = [{ lp: 1, name: "Korekta lakieru", quantity: "1.000", unitNet: "1951.22" }, { lp: 2, name: "Powłoka ceramiczna", quantity: "1.000", unitNet: "1951.22" }];
  const calls = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply({ number: "KFV/1/10/2026" }, 201));
  render(<InvoiceDetails studioId="studio-test" invoice={{ ...invoice, current }} seller={seller} />);
  await user.click(screen.getByRole("button", { name: "Wystaw korektę" }));
  const confirm = screen.getByRole("button", { name: "Potwierdź korektę" }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  const price = screen.getAllByLabelText("Cena netto (zł)")[1]!; await user.clear(price); await user.type(price, "1000");
  expect(confirm.disabled).toBe(true);
  await user.type(screen.getByLabelText("Powód korekty"), "Rabat");
  await user.click(confirm);
  const [, init] = calls.mock.calls[0]!;
  expect(calls.mock.calls[0]![0]).toBe(`/api/studios/studio-test/invoices/${invoice.id}/corrections`);
  expect(JSON.parse(String((init as RequestInit).body))).toEqual({ reason: "Rabat", items: [{ lp: 2, quantity: "1.000", unitNet: "1000" }] });
  await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith(invoiceHref("KFV/1/10/2026", "test")));
});
it("does not offer payment or corrections on a correction document", () => {
  render(<InvoiceDetails studioId="studio-test" invoice={{ ...invoice, kind: "correction", correctsNumber: "FV/41/10/2026", correctionReason: "Rabat" }} seller={seller} />);
  expect(screen.queryByRole("button", { name: "Oznacz jako opłaconą" })).toBeNull(); expect(screen.queryByRole("button", { name: "Wystaw korektę" })).toBeNull();
  expect(screen.getByRole("link", { name: "FV/41/10/2026" })).toBeTruthy();
});
