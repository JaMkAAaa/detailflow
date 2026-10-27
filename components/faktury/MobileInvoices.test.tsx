// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { InvoicesScreen } from "./InvoicesScreen";
import { InvoiceDetails } from "./InvoiceDetails";
import type { InvoiceRow } from "./list-model";
import type { InvoiceView, Seller } from "./model";

const now = "2026-10-24T08:12:08Z";
const base: InvoiceRow = {
  id: "a",
  number: "FV/41/10/2026",
  env: "test",
  status: "issued",
  ksefStatus: "accepted",
  buyerName: "Adam Nowak",
  buyerNip: null,
  orderNumber: "DF-0243",
  phone: null,
  issuedAt: now,
  dueAt: "2026-10-31T12:00:00Z",
  paidAt: null,
  totalGross: "4800",
  totalVat: "897.56",
  ksefNumber: "demo-number",
  events: [],
};
const seller: Seller = {
  name: "Obsidian",
  nip: "",
  address: "",
  postal: "",
  city: "",
  env: "test",
};
const invoice: InvoiceView = {
  ...base,
  events: [],
  acceptedAt: "2026-10-24T08:13:08Z",
  saleAt: now,
  emailedAt: now,
  upoXml: null,
  totalNet: "3902.44",
  buyer: {
    name: base.buyerName,
    nip: "",
    street: "",
    postal: "",
    city: "",
    email: "adam@example.test",
  },
  items: [
    {
      name: "Korekta lakieru",
      quantity: "1",
      unitNet: "3902.44",
      discount: "0",
      vatRate: 23,
    },
  ],
};
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("filters and searches compact cards, preserving the KSeF environment", async () => {
  const user = userEvent.setup();
  render(
    <InvoicesScreen
      invoices={[
        base,
        {
          ...base,
          id: "b",
          number: "FV/39/10/2026",
          ksefStatus: "rejected",
          buyerName: "Auto Serwis Kowal",
        },
      ]}
      env="test"
      now={now}
    />,
  );
  expect(screen.queryByRole("table")).toBeNull();
  expect(
    within(screen.getByRole("list", { name: "Lista faktur" })).getAllByRole(
      "link",
    ),
  ).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Przyjęte" }));
  const link = within(
    screen.getByRole("list", { name: "Lista faktur" }),
  ).getByRole("link");
  expect(link.getAttribute("href")).toBe(
    "/invoices/FV%2F41%2F10%2F2026?env=test",
  );
  await user.type(screen.getByRole("searchbox"), "brak");
  expect(screen.getByRole("heading", { name: /Nie znaleziono/ })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wyczyść filtry" }));
  expect(
    within(screen.getByRole("list", { name: "Lista faktur" })).getAllByRole(
      "link",
    ),
  ).toHaveLength(2);
});
it("uses shared PDF, UPO and demo payment actions from mobile details", async () => {
  const user = userEvent.setup();
  const download = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Brak dokumentu" }), { status: 409, headers: { "Content-Type": "application/json" } }));
  render(<InvoiceDetails studioId="studio-test" invoice={invoice} seller={seller} />);
  await user.click(screen.getByRole("button", { name: "PDF" }));
  expect(download).toHaveBeenCalledWith(`/api/studios/studio-test/invoices/${invoice.id}/pdf?env=test`);
  await user.click(screen.getByRole("button", { name: "UPO" }));
  expect(screen.getByRole("status").textContent).toContain("nie jest dostępne");
  await user.click(
    screen.getByRole("button", { name: "Oznacz jako opłaconą" }),
  );
  await user.click(screen.getByRole("button", { name: "Potwierdź (demo)" }));
  expect(
    (
      screen.getByRole("button", {
        name: "Opłacona (demo)",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain(
    "Nie zapisano danych",
  );
  await user.click(
    screen.getByRole("button", { name: "Więcej akcji faktury" }),
  );
  expect(screen.getByRole("dialog", { name: "Akcje faktury" })).toBeTruthy();
});
it("keeps production labels and already paid controls correct", () => {
  render(
    <InvoiceDetails studioId="studio-test"
      invoice={{ ...invoice, env: "production", paidAt: now }}
      seller={{ ...seller, env: "production" }}
    />,
  );
  expect(screen.queryByText(/TEST/)).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Opłacona" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
