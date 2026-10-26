import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-df-bg px-4 py-12">
      <Logo size={32} aria-label="Detailflow" />
      <div className="w-full max-w-[400px] rounded-xl border border-df-line bg-df-panel p-7">{children}</div>
    </main>
  );
}
