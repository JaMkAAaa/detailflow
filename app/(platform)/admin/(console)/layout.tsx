import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { requirePlatform } from "@/src/server/admin/context";

export default async function PlatformConsoleLayout({ children }: { children: ReactNode }) {
  const { user, role } = await requirePlatform();

  return (
    <div className="flex min-h-dvh bg-df-bg">
      <a
        href="#platform-content"
        className="sr-only z-30 rounded bg-df-lime px-4 py-2 text-df-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Przejdź do treści
      </a>
      <AdminSidebar user={user} role={role} />
      <div className="flex min-w-0 flex-1 flex-col ml-[220px]">
        <main id="platform-content" tabIndex={-1} className="flex-1 p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
