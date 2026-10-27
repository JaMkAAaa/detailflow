"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/auth/field";
import { platformAuthClient } from "@/lib/auth/platform-client";
import { PLATFORM_LOGIN_PATH } from "@/lib/auth/redirect";

type Mode = "password" | "magic-link";
const TOO_MANY = "Za dużo prób. Odczekaj minutę i spróbuj ponownie.";

export function PlatformLoginForm({ next, notice }: { next: string; notice?: string }) {
  const [mode, setMode] = useState<Mode>("password");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setPending(true);
    setError(undefined);

    if (mode === "password") {
      const { error } = await platformAuthClient.signIn.email({ email, password: String(form.get("password") ?? "") });
      if (!error) {
        window.location.assign(next);
        return;
      }
      setError(error.status === 403 ? "To konto nie ma dostępu do panelu platformy." : error.status === 429 ? TOO_MANY : "Nieprawidłowy e-mail lub hasło.");
    } else {
      const { error } = await platformAuthClient.signIn.magicLink({
        email,
        callbackURL: next,
        errorCallbackURL: `${PLATFORM_LOGIN_PATH}?blad=link`,
      });
      if (error) setError(error.status === 429 ? TOO_MANY : "Nie udało się wysłać linku. Spróbuj ponownie.");
      else setSentTo(email);
    }
    setPending(false);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-df-section text-df-text">Sprawdź skrzynkę</h1>
        <FormMessage tone="info">{`Jeśli ${sentTo} ma dostęp do panelu platformy, wysłaliśmy link. Link jest ważny 15 minut i działa raz.`}</FormMessage>
        <Button variant="secondary" onClick={() => setSentTo(undefined)}>Wróć do logowania</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Panel właściciela platformy</h1>
      {notice && <FormMessage tone="info">{notice}</FormMessage>}
      <Field id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" />
      {mode === "password" && (
        <Field id="password" label="Hasło" type="password" autoComplete="current-password" />
      )}
      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" loading={pending} loadingLabel={mode === "password" ? "Logowanie…" : "Wysyłanie…"}>
        {mode === "password" ? "Zaloguj się" : "Wyślij link do logowania"}
      </Button>
      <button
        type="button"
        className="text-left text-df-body text-df-muted hover:text-df-text"
        onClick={() => {
          setMode(mode === "password" ? "magic-link" : "password");
          setError(undefined);
        }}
      >
        {mode === "password" ? "Zaloguj linkiem z e-maila" : "Zaloguj hasłem"}
      </button>
    </form>
  );
}
