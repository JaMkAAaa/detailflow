// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { QuoteWizard } from "./QuoteWizard";
import { draftKey, initialDraft } from "./demo";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
const renderWizard = (studioId = "studio-a", userId = "user-a") => render(<QuoteWizard studioId={studioId} userId={userId} />);
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
  const submit = screen.getByRole("button", { name: "Potwierdź wysyłkę (demo)" }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true);
  expect(screen.getByText(/Do: Anna Wiśniewska/)).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: /26–27 października/ }));
  expect(screen.getByText(/Przyjęcie: 26.10, 08:00/)).toBeTruthy();
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  expect(submit.disabled).toBe(false);
  await user.click(submit);
  expect(screen.getByRole("heading", { name: "Wycena gotowa do wysłania" })).toBeTruthy();
  expect(screen.getByText(/Wiadomość nie została wysłana/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wróć do wyceny" }));
  expect((screen.getByRole("checkbox", { name: /Sprawdziłem/ }) as HTMLInputElement).checked).toBe(false);
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

it("reports storage failure without losing editable UI", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  renderWizard();
  expect(screen.getByText(/Nie zapisano szkicu/)).toBeTruthy();
  expect(screen.getByLabelText("Klient")).toBeTruthy();
});

it("requires a calendar choice when the restored draft has no slot", async () => {
  const user = userEvent.setup();
  localStorage.setItem(draftKey("studio-a", "user-a"), JSON.stringify({ ...initialDraft, step: 3, slotId: null }));
  renderWizard();
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  expect((screen.getByRole("button", { name: "Potwierdź wysyłkę (demo)" }) as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("radio", { name: /28–30 października/ }));
  expect(screen.getByText(/Przyjęcie: 28.10, 08:00/)).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: /Sprawdziłem/ }) as HTMLInputElement).checked).toBe(false);
});

it("saves edited operational items and sends/resends using the same quote ID", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "sent" }) });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const user = userEvent.setup();
    render(<QuoteWizard studioId="studio-a" userId="user-a" clientChoices={[{ id: "real-client", name: "Klient z bazy", email: "real@example.test", vehicles: [{ id: "real-car", label: "Porsche Panamera" }] }]} />);
    await user.click(screen.getByRole("button", { name: /Dalej: wybierz usługi/ }));
    // Step navigation moves focus in requestAnimationFrame; finish it before typing.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Nowa wycena", level: 1 })));
    const nameInput = screen.getByLabelText("Nazwa: Korekta lakieru");
    await user.clear(nameInput);
    await user.type(nameInput, "Korekta indywidualna");
    const priceInput = screen.getByLabelText("Cena bazowa: Korekta indywidualna");
    await user.clear(priceInput);
    await user.type(priceInput, "123.45");
    await user.click(screen.getByRole("button", { name: "Zapisz szkic" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(request.method).toBe("PUT");
    expect(JSON.parse(request.body)).toMatchObject({ clientId: "real-client", vehicleId: "real-car", items: [{ name: "Korekta indywidualna", basePrice: "123.45" }, { name: "Powłoka ceramiczna" }] });
    expect(JSON.parse(localStorage.getItem(draftKey("studio-a", "user-a"))!).quoteId).toBe(url.split("/").at(-1));
    await user.click(screen.getByRole("button", { name: "Termin i potwierdzenie" }));
    await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
    await user.click(screen.getByRole("button", { name: "Wyślij wycenę" }));
    await screen.findByRole("heading", { name: "Wycena zapisana i przekazana do wysyłki" });
    expect(fetchMock.mock.calls[1]![0]).toBe(url);
    expect(fetchMock.mock.calls[2]![0]).toBe(`${url}/send`);
    await user.click(screen.getByRole("button", { name: "Wyślij ponownie" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls[3]![0]).toBe(`${url}/send`);
    expect(fetchMock.mock.calls[3]![1].method).toBe("POST");
    await user.click(screen.getByRole("button", { name: "Nowa wycena" }));
    await user.click(screen.getByRole("button", { name: "Zapisz szkic" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock.mock.calls[4]![0]).not.toBe(url);
  } finally { vi.unstubAllGlobals(); }
});

it("shows save failures and retains the ID for a retry", async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error("Brak połączenia")).mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  try {
    const user = userEvent.setup();
    render(<QuoteWizard studioId="studio-a" userId="user-a" clientChoices={[{ id: "client", name: "Klient", email: null, vehicles: [{ id: "car", label: "Auto" }] }]} />);
    await user.click(screen.getByRole("button", { name: "Zapisz szkic" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Brak połączenia");
    await user.click(screen.getByRole("button", { name: "Zapisz szkic" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]![0]).toBe(fetchMock.mock.calls[0]![0]);
  } finally { vi.unstubAllGlobals(); }
});

it("asks for a client with a vehicle when the studio has none", () => {
  render(<QuoteWizard studioId="empty" userId="user" clientChoices={[]} />);
  expect(screen.getByRole("status").textContent).toContain("Dodaj klienta z samochodem");
});

it("keeps a saved hidden service on the quote and out of new choices", async () => {
  const user = userEvent.setup();
  const draft = { ...initialDraft, clientId: "real-client", vehicleId: "real-car", serviceIds: ["hidden", "wash"], step: 2 as const, notes: "" };
  render(<QuoteWizard
    studioId="studio-a"
    userId="user-a"
    clientChoices={[{ id: "real-client", name: "Klient z bazy", email: "a@example.test", vehicles: [{ id: "real-car", label: "Auto" }] }]}
    serviceChoices={[{ id: "wash", code: "wash", name: "Mycie detailingowe", description: "Mycie", price: "250.00", hours: "1", durationMin: 50 }]}
    heldServices={[{ id: "hidden", name: "Stara korekta", description: "", price: "10.00", hours: "1", durationMin: 40, inCatalog: false }]}
    initialQuote={{
      id: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      status: "draft",
      pending: false,
      items: [
        { serviceId: "hidden", name: "Stara korekta", basePrice: "10.00", durationMin: 40 },
        { serviceId: "wash", name: "Mycie detailingowe", basePrice: "250.00", durationMin: 50 },
      ],
      draft,
    }}
  />);
  expect(screen.getByLabelText("Nazwa: Stara korekta")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Dodaj z katalogu/ }));
  expect(screen.queryByRole("checkbox", { name: /Stara korekta/ })).toBeNull();
  expect(screen.getByRole("checkbox", { name: /Mycie detailingowe/ })).toBeTruthy();
});
