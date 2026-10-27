// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { InvoiceWizard, invoiceDraftKey } from "./InvoiceWizard";
import { InvoiceDetails } from "./InvoiceDetails";
import { invoiceNumberFromSegment, invoiceHref, totals, validBuyer, type InvoiceView, type Order, type Seller } from "./model";
const seller: Seller = { name: "Obsidian", nip: "9512345678", address: "Warszawska 1", postal: "00-001", city: "Warszawa", env: "test" };
const orders: Order[] = [{ id: "order", number: "DF-0243", vehicle: "BMW X3", completedAt: "2026-10-23T14:30:00Z", buyer: { name: "Adam Nowak", nip: "", street: "Puławska 120/4", postal: "02-620", city: "Warszawa", email: "adam@example.com" }, items: ["Korekta lakieru", "Powłoka ceramiczna"].map(name => ({ name, quantity: "1", unitNet: "1951.22", vatRate: 23, discount: "0" })) }];
const invoice: InvoiceView = { id: "invoice", number: "FV/41/10/2026", env: "test", status: "issued", ksefStatus: "accepted", ksefNumber: "demo-number", acceptedAt: "2026-10-24T08:13:08Z", issuedAt: "2026-10-24T08:12:08Z", saleAt: "2026-10-24T08:12:08Z", dueAt: "2026-10-31T12:00:00Z", paidAt: null, emailedAt: "2026-10-24T08:13:30Z", upoXml: null, orderNumber: "DF-0243", buyer: orders[0]!.buyer, items: orders[0]!.items, totalNet: "3902.44", totalVat: "897.56", totalGross: "4800", events: [] };
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
it("labels PROD explicitly, exposes document controls, and confirms demo payment", async () => {
  const user = userEvent.setup(); const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<InvoiceDetails invoice={{ ...invoice, env: "production" }} seller={seller} />);
  expect(screen.getByText("PROD")).toBeTruthy(); expect(screen.queryByText("Przyjęta (test)")).toBeNull();
  expect(screen.getByText("60 s")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /UPO/ })); expect(screen.getByRole("status").textContent).toContain("nie jest dostępne");
  await user.click(screen.getByRole("button", { name: "Pobierz PDF" })); expect(print).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Oznacz jako opłaconą" }));
  await user.click(screen.getByRole("button", { name: "Potwierdź (demo)" }));
  expect(screen.getByText("Opłacona (demo)")).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("Nie zapisano danych");
});
