// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { idleForm, type FormState } from "@/src/server/admin/errors";
import { SuspendForm, SupportSessionForm } from "./AccessTools";
import { OperatorsScreen } from "./OperatorsScreen";
import { SupportScreen } from "./SupportScreen";
import { SystemScreen } from "./SystemScreen";
import type { SystemSnapshot } from "@/src/server/admin/system";

vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

afterEach(cleanup);

const noop = async (state: FormState): Promise<FormState> => state;

const snapshot: SystemSnapshot = {
  services: [
    { key: "database", label: "PostgreSQL", status: "ok", hint: "Zapytanie SELECT 1" },
    { key: "redis", label: "Redis", status: "down", hint: "PING brokera kolejki" },
    { key: "stripe", label: "Stripe", status: "unconfigured", hint: "Klucz abonamentu, bez wywołania API" },
    { key: "mail", label: "Poczta", status: "unconfigured", hint: "SMTP albo Resend" },
  ],
  ksef: {
    test: { accepted: 828, rejected: 9, pending: 5, total: 842, rateLabel: "98,3%", ageMinutes: 2 },
    production: { accepted: 1, rejected: 1, pending: 0, total: 2, rateLabel: "50,0%", ageMinutes: null },
  },
  incidents: [],
  errors: { test: [{ message: "NIP nabywcy", count: 9 }], production: [] },
};

it("pokazuje osobny udział TEST i PROD", () => {
  render(<SystemScreen data={snapshot} />);
  const test = screen.getByRole("article", { name: "KSeF TEST" });
  const prod = screen.getByRole("article", { name: "KSeF PROD" });
  expect(test.textContent).toContain("98,3%");
  expect(test.textContent).toContain("828");
  expect(prod.textContent).toContain("50,0%");
  expect(prod.textContent).not.toContain("98,3%");
  expect(screen.getByText("NIP nabywcy")).toBeTruthy();
  expect(screen.getByText("Brak odrzuceń w tym środowisku.")).toBeTruthy();
});

it("trzyma zawieszenie nieaktywne bez nazwy i powodu", async () => {
  const user = userEvent.setup();
  render(<SuspendForm publicCode="ST-00128" action={noop} />);
  const button = screen.getByRole("button", { name: "Zawieś konto" });
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Nazwa studia"), "Obsidian Studio");
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Powód"), "nadużycie");
  expect(button.hasAttribute("disabled")).toBe(false);
});

it("trzyma sesję wsparcia nieaktywną bez powodu i zgłoszenia", async () => {
  const user = userEvent.setup();
  render(<SupportSessionForm publicCode="ST-00128" action={noop} />);
  const button = screen.getByRole("button", { name: "Rozpocznij sesję" });
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Powód"), "podgląd faktury");
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Numer zgłoszenia"), "TK-00041");
  expect(button.hasAttribute("disabled")).toBe(false);
});

it("nie wysyła pustej odpowiedzi", async () => {
  const user = userEvent.setup();
  render(
    <SupportScreen
      replyAction={noop}
      openAction={noop}
      resolveAction={noop}
      data={{
        tickets: [],
        selected: {
          publicCode: "TK-00041",
          subject: "Faktura TEST",
          status: "open",
          statusLabel: "Otwarte",
          priorityLabel: "Pilny",
          sla: "ok",
          remaining: "40 min",
          studio: { publicCode: "ST-00128", name: "Obsidian Studio", statusLabel: "Aktywne", planName: "Studio", city: "Warszawa", phone: null },
          messages: [{ id: "1", body: "Proszę o podgląd.", fromStudio: true, at: "2026-10-28T10:00:00.000Z" }],
        },
      }}
    />,
  );
  const button = screen.getByRole("button", { name: "Wyślij odpowiedź" });
  expect(button.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Odpowiedź"), "Sprawdzamy.");
  expect(button.hasAttribute("disabled")).toBe(false);
});

it("chowa role i flagi, dopóki nie ma MFA", () => {
  render(
    <OperatorsScreen
      actorRole="owner"
      access="challenge"
      administration={null}
      beginAction={async () => idleForm}
      confirmAction={async () => idleForm}
      challengeAction={noop}
      roleAction={noop}
      flagAction={noop}
    />,
  );
  expect(screen.queryByRole("heading", { name: "Role operatorów" })).toBeNull();
  expect(screen.getByLabelText("Kod MFA")).toBeTruthy();
});
