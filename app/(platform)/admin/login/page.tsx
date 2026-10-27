import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { PlatformLoginForm } from "@/components/admin/login-form";
import { safeAdminNext } from "@/lib/auth/redirect";
import { getPlatformSession } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Panel platformy — Detailflow" };

const NOTICES: Record<string, string> = {
  link: "Link do logowania wygasł albo został już użyty. Poproś o nowy.",
};

type Props = { searchParams: Promise<{ next?: string; blad?: string }> };

export default async function PlatformLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeAdminNext(params.next);
  if (await getPlatformSession()) redirect(next);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-df-bg px-4 py-12">
      <Logo size={32} aria-label="Detailflow" />
      <div className="w-full max-w-[400px] rounded-xl border border-df-line bg-df-panel p-7">
        <PlatformLoginForm next={next} notice={NOTICES[params.blad ?? ""]} />
      </div>
    </main>
  );
}
