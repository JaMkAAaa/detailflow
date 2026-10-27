// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { QuoteWizard } from "./QuoteWizard";
import { clients, services, draftKey, initialDraft } from "./demo";

const mocks = vi.hoisted(() => ({ save: vi.fn(), send: vi.fn(), edit: vi.fn() }));
vi.mock("@/app/(studio)/quotes/new/actions", () => ({ saveQuoteAction: mocks.save, sendQuoteAction: mocks.send, updateServiceAction: mocks.edit }));
const data = { clients: clients.map((client) => ({ ...client, vehicles: [...client.vehicles] })), services: services.map((service) => ({ ...service, code: service.id, durationMin: Number(service.hours) * 50 })), quote: null };
beforeEach(() => {
  mocks.save.mockReset().mockImplementation(async (_studioId, input) => ({ ok: true, value: { id: input.id, revision: input.revision + 1 } }));
  mocks.send.mockReset().mockResolvedValue({ ok: true, value: { emailId: "email-1" } });
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const renderWizard = (studioId = "studio-a", userId = "user-a") => render(<QuoteWizard studioId={studioId} userId={userId} data={data} />);
const total = () => screen.getByLabelText("Kwota brutto").textContent;

it("shows D-06 totals, recalculates size, paint and duration using Decimal", async () => {
  const user = userEvent.setup();
  renderWizard();
  expect(total()).toBe("4 800 zł");
  expect(screen.getByText("Brutto, w tym VAT 23%: 897,56 zł")).toBeTruthy();
  expect(screen.getByText("2 usługi · 12 h pracy")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /SUV/ }));
  expect(total()).toBe("5 400 zł");
  expect(screen.getByText("2 usługi · 13,5 h pracy")).toBeTruthy();
  await user.selectOptions(screen.getByLabelText("Stan lakieru"), "worn");
  expect(total()).toBe("6 480 zł");
});

it("blocks every entry to step 3 without services and lets the catalog restore them", async () => {
  const user = userEvent.setup();
  renderWizard();
  await user.click(screen.getByRole("button", { name: /Dalej: wybierz usługi/ }));
  await user.click(screen.getByRole("button", { name: "Usuń: Korekta lakieru" }));
  await user.click(screen.getByRole("button", { name: "Usuń: Powłoka ceramiczna" }));
  expect(total()).toBe("0 zł");
  for (const name of [/Termin i potwierdzenie/, /Dalej: wybierz termin/, /Sprawdź kalendarz/]) {
    expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
  }
  await user.click(screen.getByRole("button", { name: /Dodaj z katalogu/ }));
  await user.click(screen.getByRole("checkbox", { name: /Detailing wnętrza/ }));
  await user.click(screen.getByRole("button", { name: "Gotowe" }));
  expect(total()).toBe("780 zł");
  await user.click(screen.getByRole("button", { name: /Dalej: wybierz termin/ }));
  expect(screen.getByRole("heading", { name: "Podgląd wiadomości" })).toBeTruthy();
});

it("autosaves notes and the step across remounts while keeping studio/user drafts separate", async () => {
  const user = userEvent.setup();
  const first = renderWizard();
  await user.click(screen.getByRole("button", { name: /Dalej: wybierz usługi/ }));
  await user.clear(screen.getByLabelText("Uwagi do wyceny"));
  await user.type(screen.getByLabelText("Uwagi do wyceny"), "Kontakt przed odbiorem.");
  await waitFor(() => expect(JSON.parse(localStorage.getItem(draftKey("studio-a", "user-a"))!).notes).toBe("Kontakt przed odbiorem."));
  first.unmount();
  const second = renderWizard();
  expect((screen.getByLabelText("Uwagi do wyceny") as HTMLTextAreaElement).value).toBe("Kontakt przed odbiorem.");
  await user.click(screen.getByRole("button", { name: /Wstecz/ }));
  expect(screen.getByRole("button", { name: "Klient i auto" }).getAttribute("aria-current")).toBe("step");
  second.unmount();
  const otherStudio = renderWizard("studio-b");
  expect(screen.getByRole("button", { name: "Klient i auto" }).getAttribute("aria-current")).toBe("step");
  expect(JSON.parse(localStorage.getItem(draftKey("studio-b", "user-a"))!).notes).toBe(initialDraft.notes);
  otherStudio.unmount();
  renderWizard("studio-a", "user-b");
  expect(JSON.parse(localStorage.getItem(draftKey("studio-a", "user-b"))!).notes).toBe(initialDraft.notes);
});

it("changes the vehicle with the client, previews their data, and requires confirmation", async () => {
  const user = userEvent.setup();
  renderWizard();
  await user.selectOptions(screen.getByLabelText("Klient"), "anna");
  expect((screen.getByLabelText("Samochód") as HTMLSelectElement).value).toBe("audi");
  await user.click(screen.getByRole("button", { name: "Termin i potwierdzenie" }));
  const submit = screen.getByRole("button", { name: "Potwierdź wysyłkę" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(screen.getByText(/Do: Anna Wiśniewska/)).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /26–27 października/ }));
  expect(screen.getByText(/Przyjęcie: 26.10, 08:00/)).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  expect(submit.disabled).toBe(false);
  await user.click(submit);
  await screen.findByRole("heading", { name: "Wycena zapisana i przekazana do wysyłki" });
  expect(mocks.send).toHaveBeenCalledTimes(1);
  const lastSave = mocks.save.mock.calls.at(-1)![1];
  expect(lastSave).toMatchObject({ clientId: "anna", vehicleId: "audi", slotId: "oct26" });
  expect(lastSave.items).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Wyślij ponownie" }));
  await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(2));
  expect(mocks.save.mock.calls.at(-1)![1]).toBe(lastSave);
});

it("handles malformed drafts and prevents restoring step 3 with no services", () => {
  localStorage.setItem(draftKey("studio-a", "user-a"), "invalid JSON");
  const first = renderWizard();
  expect(screen.getByRole("alert").textContent).toContain("Nie udało się odczytać");
  expect(total()).toBe("4 800 zł");
  first.unmount();
  localStorage.setItem(draftKey("studio-a", "user-a"), JSON.stringify({ ...initialDraft, step: 3, serviceIds: [] }));
  renderWizard();
  expect(screen.getByRole("button", { name: "Usługi i wycena" }).getAttribute("aria-current")).toBe("step");
});

it("saves to the server even when browser storage fails", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  renderWizard();
  await screen.findByText("✓ Zapisano szkic w studiu");
  expect(mocks.save).toHaveBeenCalled();
  expect(screen.getByLabelText("Klient")).toBeTruthy();
});

it("requires a calendar choice when the restored draft has no slot", async () => {
  const user = userEvent.setup();
  localStorage.setItem(draftKey("studio-a", "user-a"), JSON.stringify({ ...initialDraft, step: 3, slotId: null }));
  renderWizard();
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  expect((screen.getByRole("button", { name: "Potwierdź wysyłkę" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("radio", { name: /28–30 października/ }));
  expect(screen.getByText(/Przyjęcie: 28.10, 08:00/)).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: /Sprawdziłem/ }) as HTMLInputElement).checked).toBe(false);
});

it("does not send when the final save fails and keeps the draft editable", async () => {
  const user = userEvent.setup();
  mocks.save.mockResolvedValue({ ok: false, error: "Błąd zapisu" });
  renderWizard();
  await user.click(screen.getByRole("button", { name: "Termin i potwierdzenie" }));
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  await user.click(screen.getByRole("button", { name: "Potwierdź wysyłkę" }));
  expect(await screen.findByText("Błąd zapisu")).toBeTruthy();
  expect(mocks.send).not.toHaveBeenCalled();
});
