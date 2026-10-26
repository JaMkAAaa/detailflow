"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupTrial } from "@/app/(auth)/start/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "./field";

export function SignupForm() {
  const [state, action, pending] = useActionState(signupTrial, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Wypróbuj Detailflow</h1>
      <p className="text-df-body text-df-muted">14 dni bez karty. Zacznij z planem Solo.</p>
      <Field id="name" label="Imię i nazwisko" autoComplete="name" maxLength={100} />
      <Field id="studioName" label="Nazwa studia" autoComplete="organization" maxLength={100} />
      <Field id="email" label="E-mail" type="email" autoComplete="email" inputMode="email" maxLength={254} />
      <Field id="password" label="Hasło" type="password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} maxLength={128} />
      {state.error && <FormMessage>{state.error}</FormMessage>}
      <Button type="submit" loading={pending} loadingLabel="Tworzenie studia…">Rozpocznij 14 dni za darmo</Button>
      <Link href="/login" className="text-df-body text-df-muted hover:text-df-text">Masz już konto? Zaloguj się</Link>
    </form>
  );
}
