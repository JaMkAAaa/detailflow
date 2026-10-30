// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuoteOrder } from "./QuoteOrder";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
const props = {
  studioId: "studio", status: "accepted", orderNumber: null,
  quote: { id: "quote", clientId: "client", vehicleId: "car", service: "Korekta, Mycie", totalGross: "132.01" },
  clients: [{ id: "client", name: "Adam", vehicles: [{ id: "car", label: "Fiat Panda" }] }],
  bays: [{ id: "bay", name: "Boks 1" }],
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe("quote order form", () => {
  it("prefills the snapshot and requires a human to choose dates and bay", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ number: "DF-0001" }) });
    vi.stubGlobal("fetch", fetcher);
    render(<QuoteOrder {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Utwórz zlecenie" }));
    expect(screen.getByLabelText("Klient").getAttribute("data-value")).toBe("client");
    expect(screen.getByLabelText("Auto").getAttribute("data-value")).toBe("car");
    expect((screen.getByLabelText("Usługa") as HTMLInputElement).value).toBe("Korekta, Mycie");
    expect((screen.getByLabelText("Kwota brutto") as HTMLInputElement).value).toBe("132.01");
    for (const label of ["Termin od", "Termin do"]) expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("");
    expect(screen.getByLabelText("Boks").getAttribute("data-value")).toBe("");
    fireEvent.change(screen.getByLabelText("Termin od"), { target: { value: "2026-11-02T10:00" } });
    fireEvent.change(screen.getByLabelText("Termin do"), { target: { value: "2026-11-02T12:00" } });
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Boks"));
    await user.click(screen.getByRole("option", { name: "Boks 1" }));
    fireEvent.submit(screen.getByLabelText("Klient").closest("form")!);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/orders/DF-0001"));
    expect(fetcher.mock.calls[0]![0]).toBe("/api/studios/studio/quotes/quote/order");
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toMatchObject({ totalGross: "132.01", bayId: "bay" });
  });
  it("opens an existing order and hides creation for nonaccepted quotes", () => {
    for (const status of ["draft", "sent", "rejected", "expired"]) {
      const view = render(<QuoteOrder {...props} status={status} />);
      expect(screen.queryByRole("button", { name: "Utwórz zlecenie" })).toBeNull();
      view.unmount();
    }
    render(<QuoteOrder {...props} orderNumber="DF-0248" />);
    expect(screen.getByRole("link", { name: "Otwórz zlecenie" }).getAttribute("href")).toBe("/orders/DF-0248");
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("keeps conflicts in the form", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Boks jest zajęty." }) }));
    render(<QuoteOrder {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Utwórz zlecenie" }));
    fireEvent.submit(screen.getByLabelText("Klient").closest("form")!);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Boks jest zajęty."));
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
