"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { Field, FormMessage } from "./field";

export function ResetRequestForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(undefined);
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    // Ten sam komunikat dla istniejącego i nieznanego e-maila.
    if (!error) setSent(true);
    else setError(error.status === 429 ? "Za dużo prób. Odczekaj minutę i spróbuj ponownie." : "Nie udało się wysłać prośby. Spróbuj ponownie.");
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-df-section text-df-text">Sprawdź skrzynkę</h1>
        <FormMessage tone="info">Jeśli konto z tym adresem istnieje, wysłaliśmy link do ustawienia nowego hasła. Link jest ważny 60 minut.</FormMessage>
        <Link href={LOGIN_PATH} className="text-center text-df-body text-df-muted hover:text-df-text">Wróć do logowania</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Reset hasła</h1>
      <p className="text-df-body text-df-muted">Podaj e-mail konta. Wyślemy link do ustawienia nowego hasła.</p>
      <Field id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" />
      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" loading={pending} loadingLabel="Wysyłanie…">Wyślij link</Button>
      <Link href={LOGIN_PATH} className="text-center text-df-body text-df-muted hover:text-df-text">Wróć do logowania</Link>
    </form>
  );
}
