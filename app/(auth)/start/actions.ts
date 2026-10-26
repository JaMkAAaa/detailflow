"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createTrialStudio, SignupError } from "@/src/server/studio/create";

export async function signupTrial(_state: { error?: string }, form: FormData): Promise<{ error?: string }> {
  let email: string;
  try {
    ({ email } = await createTrialStudio({
      name: form.get("name"),
      studioName: form.get("studioName"),
      email: form.get("email"),
      password: form.get("password"),
    }));
  } catch (error) {
    if (error instanceof SignupError) return { error: error.message };
    console.error("Trial signup failed", error);
    return { error: "Nie udało się utworzyć konta. Spróbuj ponownie." };
  }

  try {
    // nextCookies zapisuje httpOnly cookie w odpowiedzi Server Action.
    await auth.api.signInEmail({
      headers: await headers(),
      body: { email, password: String(form.get("password")) },
    });
  } catch {
    // Konto już istnieje — nie zachęcamy do powtórnego signup.
    redirect("/login?info=trial");
  }
  redirect("/");
}
