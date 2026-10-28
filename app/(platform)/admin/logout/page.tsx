import type { Metadata } from "next";
import { headers } from "next/headers";
import { assertActionOrigin } from "@/src/server/action-origin";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { platformAuth } from "@/lib/auth/platform";
import { PLATFORM_LOGIN_PATH } from "@/lib/auth/redirect";
import { getPlatformSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Wylogowanie — panel platformy" };

async function signOut() {
  "use server";
  await assertActionOrigin();
  await platformAuth.api.signOut({ headers: await headers() });
  redirect(PLATFORM_LOGIN_PATH);
}

export default async function PlatformSignOutPage() {
  const session = await getPlatformSession();
  if (!session) redirect(PLATFORM_LOGIN_PATH);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-df-bg px-4 py-12">
      <Logo size={32} aria-label="Detailflow" />
      <form action={signOut} className="flex w-full max-w-[400px] flex-col gap-4 rounded-xl border border-df-line bg-df-panel p-7">
        <h1 className="text-df-section text-df-text">Wylogować się z panelu?</h1>
        <p className="text-df-body text-df-muted">Zalogowano jako {session.user.email}.</p>
        <Button type="submit">Wyloguj</Button>
        <Link href="/admin" className="text-center text-df-body text-df-muted hover:text-df-text">Wróć do przeglądu</Link>
      </form>
    </main>
  );
}
