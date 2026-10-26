import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/redirect";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Logowanie — Detailflow" };

const NOTICES: Record<string, string> = {
  link: "Link do logowania wygasł albo został już użyty. Poproś o nowy.",
  haslo: "Hasło zmienione. Zaloguj się nowym hasłem.",
};

type Props = { searchParams: Promise<{ next?: string; blad?: string; info?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await getSession()) redirect(next);

  const notice = NOTICES[params.blad ?? params.info ?? ""];
  return <LoginForm next={next} notice={notice} />;
}
