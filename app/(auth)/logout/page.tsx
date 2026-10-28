import type { Metadata } from "next";
import { headers } from "next/headers";
import { assertActionOrigin } from "@/src/server/action-origin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Wylogowanie — Detailflow" };

// Server Action (POST z kontrolą Origin), żeby link z zewnątrz nie wylogował po GET.
async function signOut() {
  "use server";
  await assertActionOrigin();
  await auth.api.signOut({ headers: await headers() });
  redirect(LOGIN_PATH);
}

export default async function SignOutPage() {
  const session = await getSession();
  if (!session) redirect(LOGIN_PATH);

  return (
    <form action={signOut} className="flex flex-col gap-4">
      <h1 className="text-df-section text-df-text">Wylogować się?</h1>
      <p className="text-df-body text-df-muted">Zalogowano jako {session.user.email}.</p>
      <Button type="submit">Wyloguj</Button>
      <Link href="/" className="text-center text-df-body text-df-muted hover:text-df-text">Wróć do studia</Link>
    </form>
  );
}
