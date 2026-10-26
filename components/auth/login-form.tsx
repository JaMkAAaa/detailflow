"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { Field, FormMessage } from "./field";

type Mode = "password" | "magic-link";

const TOO_MANY = "Za dużo prób. Odczekaj minutę i spróbuj ponownie.";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
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
      const { error } = await authClient.signIn.email({ email, password: String(form.get("password") ?? "") });
      if (!error) {
        // Pełne przeładowanie: layout studia czyta świeże cookie sesji.
        window.location.assign(next);
        return;
      }
      setError(error.status === 429 ? TOO_MANY : "Nieprawidłowy e-mail lub hasło.");
    } else {
      const { error } = await authClient.signIn.magicLink({ email, callbackURL: next, errorCallbackURL: `${LOGIN_PATH}?blad=link` });
      if (error) setError(error.status === 429 ? TOO_MANY : "Nie udało się wysłać linku. Spróbuj ponownie.");
      else setSentTo(email);
    }
    setPending(false);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-df-section text-df-text">Sprawdź skrzynkę</h1>
        <FormMessage tone="info">{`Jeśli ${sentTo} ma konto w Detailflow, wysłaliśmy link do logowania. Link jest ważny 15 minut i działa raz.`}</FormMessage>
        <Button variant="secondary" onClick={() => setSentTo(undefined)}>Wróć do logowania</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Zaloguj się do studia</h1>
      {notice && <FormMessage tone="info">{notice}</FormMessage>}

      <Field id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" />
      {mode === "password" && (
        <Field id="password" label="Hasło" type="password" autoComplete="current-password" />
      )}

      {error && <FormMessage>{error}</FormMessage>}

      <Button type="submit" loading={pending} loadingLabel={mode === "password" ? "Logowanie…" : "Wysyłanie…"}>
        {mode === "password" ? "Zaloguj się" : "Wyślij link do logowania"}
      </Button>

      <div className="flex items-center justify-between gap-3 text-df-body">
        <button
          type="button"
          className="text-df-muted hover:text-df-text"
          onClick={() => {
            setMode(mode === "password" ? "magic-link" : "password");
            setError(undefined);
          }}
        >
          {mode === "password" ? "Zaloguj linkiem z e-maila" : "Zaloguj hasłem"}
        </button>
        {mode === "password" && <Link href="/forgot-password" className="text-df-muted hover:text-df-text">Nie pamiętasz hasła?</Link>}
      </div>
      <Link href="/start" className="text-df-body text-df-muted hover:text-df-text">Wypróbuj za darmo przez 14 dni</Link>
    </form>
  );
}
