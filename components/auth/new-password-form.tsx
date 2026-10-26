"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { Field, FormMessage } from "./field";

export function NewPasswordForm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setError("Hasła nie są takie same.");
      return;
    }
    setPending(true);
    setError(undefined);
    const { error } = await authClient.resetPassword({ newPassword, token });
    if (!error) {
      window.location.assign(`${LOGIN_PATH}?info=haslo`);
      return;
    }
    setPending(false);
    if (error.code === "INVALID_TOKEN") setError("Link wygasł albo został już użyty. Poproś o nowy.");
    else if (error.code === "PASSWORD_TOO_SHORT") setError(`Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`);
    else setError("Nie udało się zmienić hasła. Spróbuj ponownie.");
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Ustaw nowe hasło</h1>
      <p className="text-df-body text-df-muted">Co najmniej {PASSWORD_MIN_LENGTH} znaków. Po zmianie wylogujemy wszystkie sesje tego konta.</p>
      <Field id="password" label="Nowe hasło" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
      <Field id="confirm" label="Powtórz hasło" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} />
      {error && <FormMessage>{error}</FormMessage>}
      <Button type="submit" loading={pending} loadingLabel="Zapisywanie…">Zmień hasło</Button>
    </form>
  );
}
