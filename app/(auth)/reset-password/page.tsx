import type { Metadata } from "next";
import Link from "next/link";
import { FormMessage } from "@/components/auth/field";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export const metadata: Metadata = { title: "Nowe hasło — Detailflow" };

// Link z e-maila → /api/auth/reset-password/:token → tutaj z ?token= albo ?error=INVALID_TOKEN.
type Props = { searchParams: Promise<{ token?: string; error?: string }> };

export default async function NewPasswordPage({ searchParams }: Props) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-df-section text-df-text">Link nieważny</h1>
        <FormMessage>Link do resetu hasła wygasł albo został już użyty.</FormMessage>
        <Link href="/forgot-password" className="text-center text-df-body text-df-muted hover:text-df-text">Poproś o nowy link</Link>
      </div>
    );
  }
  return <NewPasswordForm token={token} />;
}
