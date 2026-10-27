// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { QuoteWizard } from "./QuoteWizard";
import { draftKey, initialDraft } from "./demo";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
function setup(operational = false) {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }));
  const choices = [
    {
      id: "adam",
      name: "Adam Nowak",
      email: "adam@example.test",
      vehicles: [{ id: "porsche", label: "Porsche Panamera · WA 911PC" }],
    },
  ];
  localStorage.setItem(
    draftKey("studio-a", "user-a"),
    JSON.stringify({ ...initialDraft, step: 2 }),
  );
  return render(
    <QuoteWizard
      studioId="studio-a"
      userId="user-a"
      clientChoices={operational ? choices : undefined}
    />,
  );
}
it("recalculates the compact quote, blocks an empty selection and lets v1.1 options be dismissed", async () => {
  const user = userEvent.setup();
  setup();
  expect(screen.getByLabelText("Kwota brutto").textContent).toBe("4 800 zł");
  await user.click(screen.getByRole("radio", { name: /SUV/ }));
  expect(screen.getByLabelText("Kwota brutto").textContent).toBe("5 400 zł");
  await user.click(
    screen.getByRole("button", { name: "Więcej opcji: lakier i wnętrze" }),
  );
  expect(screen.getByRole("dialog", { name: /v1.1/ })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Wróć do wyceny" }));
  await user.click(screen.getByRole("checkbox", { name: /Korekta lakieru/ }));
  await user.click(
    screen.getByRole("checkbox", { name: /Powłoka ceramiczna/ }),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Dalej: wybierz termin",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: /Detailing wnętrza/ }));
  await user.click(
    screen.getByRole("button", { name: "Dalej: wybierz termin" }),
  );
  expect(
    screen.getByRole("heading", { name: "Podgląd wiadomości" }),
  ).toBeTruthy();
});
it("sends the mobile selection through the existing tenant quote API", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  setup(true);
  await user.click(
    screen.getByRole("checkbox", { name: /Powłoka ceramiczna/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Dalej: wybierz termin" }),
  );
  await user.click(screen.getByRole("checkbox", { name: /Sprawdziłem/ }));
  await user.click(screen.getByRole("button", { name: "Wyślij wycenę" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[0]![0]).toMatch(
    /^\/api\/studios\/studio-a\/quotes\//,
  );
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).items).toEqual([
    { name: "Korekta lakieru", basePrice: "2000.00", durationMin: 400 },
  ]);
  expect(fetchMock.mock.calls[1]![0]).toBe(
    `${fetchMock.mock.calls[0]![0]}/send`,
  );
});
