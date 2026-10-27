import type { ReactNode } from "react";
import { Sidebar } from "@/components/studio/Sidebar";
import { TabBar } from "@/components/studio/TabBar";
import { Topbar } from "@/components/studio/Topbar";
import { requireStudio } from "@/src/server/studio/context";

export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireStudio();
  const role = context.choices.find((choice) => choice.studioId === context.studioId)!.role;

  return (
    <div className="flex min-h-dvh bg-df-bg">
      <a
        href="#studio-content"
        className="sr-only z-30 rounded bg-df-lime px-4 py-2 text-df-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Przejdź do treści
      </a>
      <Sidebar
        choices={context.choices}
        studioId={context.studioId}
        user={context.user}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[220px]">
        <Topbar />
        <main id="studio-content" tabIndex={-1} className="flex-1 p-4 pb-[120px] lg:p-7 lg:pb-7">
          {children}
        </main>
      </div>
      <TabBar role={role} />
    </div>
  );
}
