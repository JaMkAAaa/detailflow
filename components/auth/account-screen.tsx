"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import type { OwnAccount } from "@/src/server/account/query";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "./field";

const panel = "space-y-4 rounded-xl border border-df-line bg-df-panel p-5";
const date = (value: string) => new Date(value).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });

export function AccountScreen({ account }: { account: OwnAccount }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setPending(true);
    setMessage("");
    setError("");
    try { await action(); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Nie udało się zapisać zmian. Spróbuj ponownie."); }
    finally { setPending(false); }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (form.get("newPassword") !== form.get("confirm")) {
      setMessage(""); setError("Hasła nie są takie same."); return;
    }
    await run(async () => {
      const { error } = await authClient.changePassword({
        currentPassword: String(form.get("currentPassword")),
        newPassword: String(form.get("newPassword")), revokeOtherSessions: true,
      });
      if (error) throw new Error(error.code === "INVALID_PASSWORD" ? "Obecne hasło jest nieprawidłowe." : "Nie udało się zmienić hasła. Zaloguj się ponownie i spróbuj jeszcze raz.");
      formElement.reset();
      setMessage("Hasło zmienione. Pozostałe sesje zostały wylogowane.");
    });
  }
  return <div className="mx-auto max-w-2xl space-y-6">
    <header>
      <h1 className="text-df-headline">Konto</h1>
      <p className="mt-2 text-df-muted">{account.name} · {account.email}</p>
    </header>
    {message && <FormMessage tone="info">{message}</FormMessage>}
    {error && <FormMessage>{error}</FormMessage>}
    <section className={panel} aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-df-section">Zmiana hasła</h2>
      <p className="text-df-body text-df-muted">Co najmniej {PASSWORD_MIN_LENGTH} znaków. Po zmianie wylogujemy pozostałe sesje konta we wszystkich studiach.</p>
      <form onSubmit={changePassword} className="space-y-4">
        <Field id="currentPassword" label="Obecne hasło" type="password" autoComplete="current-password" />
        <Field id="newPassword" label="Nowe hasło" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
        <Field id="confirm" label="Powtórz nowe hasło" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
        <Button type="submit" disabled={pending}>Zmień hasło</Button>
      </form>
      <a href="/forgot-password" className="text-df-body underline">Nie pamiętasz hasła lub logujesz się tylko linkiem? Ustaw hasło przez e-mail.</a>
    </section>
    <section className={panel} aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="text-df-section">Aktywne sesje</h2>
      <ul className="divide-y divide-df-line">
        {account.sessions.map(session => <li key={session.id} className="space-y-1 py-3 text-df-body">
          <p className="font-semibold">{session.current ? "Bieżąca sesja" : "Inna sesja"}</p>
          <p className="break-words text-df-muted">{session.userAgent || "Nieznane urządzenie"}</p>
          <p className="text-df-muted">IP: {session.ipAddress || "Brak danych"}</p>
          <p className="text-df-muted">Utworzono: {date(session.createdAt)} · Wygasa: {date(session.expiresAt)}</p>
        </li>)}
      </ul>
      <Button disabled={pending || !account.sessions.some(session => !session.current)} onClick={() => void run(async () => {
        const { error } = await authClient.revokeOtherSessions();
        if (error) throw new Error("Nie udało się wylogować sesji. Zaloguj się ponownie i spróbuj jeszcze raz.");
        setMessage("Pozostałe sesje zostały wylogowane.");
      })}>Wyloguj pozostałe sesje</Button>
    </section>
    <section className={panel} aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="text-df-section">Powiadomienia e-mail</h2>
      <p className="text-df-body text-df-muted">Preferencja dotyczy Twojego konta we wszystkich studiach. Przypomnienie otrzymują właściciele studia.</p>
      <form onSubmit={event => {
        event.preventDefault();
        const trialReminderEnabled = new FormData(event.currentTarget).get("trialReminderEnabled") === "on";
        void run(async () => {
          const response = await fetch("/api/account/preferences", {
            method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ trialReminderEnabled }),
          });
          if (!response.ok) throw new Error("Nie udało się zapisać preferencji.");
          setMessage("Preferencje zapisane.");
        });
      }} className="space-y-4">
        <label className="flex items-center gap-3 text-df-body">
          <input key={String(account.trialReminderEnabled)} type="checkbox" name="trialReminderEnabled" defaultChecked={account.trialReminderEnabled} disabled={pending} className="size-4 accent-df-lime" />
          Przypomnienie o końcu okresu próbnego
        </label>
        <p className="text-df-body text-df-muted">Maile z fakturami, resetem hasła i linkiem do logowania pozostają włączone.</p>
        <Button type="submit" disabled={pending}>Zapisz preferencje</Button>
      </form>
    </section>
  </div>;
}
