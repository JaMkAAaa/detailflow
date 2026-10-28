import type { ReactNode } from "react";
import { KsefEnvBadge } from "@/components/ksef/KsefEnvBadge";
import { Sidebar } from "@/components/studio/Sidebar";
import { TabBar } from "@/components/studio/TabBar";
import { Topbar } from "@/components/studio/Topbar";
import { GlobalSearch } from "@/components/studio/GlobalSearch";
import { requireStudio } from "@/src/server/studio/context";
import { invoiceAttentionCount } from "@/src/server/faktury/list-query";

export default async function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireStudio();
  const current = context.choices.find((choice) => choice.studioId === context.studioId)!;
  const role = current.role;
  const attentionCount = role === "worker" ? 0 : await invoiceAttentionCount(context.studioId, current.studio.ksefEnv);

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
        attentionCount={attentionCount}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[220px]">
        <Topbar />
        <main id="studio-content" tabIndex={-1} className="flex-1 p-4 pb-[120px] lg:p-7 lg:pb-7">
          <div className="mb-4 lg:hidden"><KsefEnvBadge env={current.studio.ksefEnv} /></div>
          {context.restriction && <div role="status" className="mb-6 rounded-lg border border-df-lime p-4">
            <p>{context.restriction} Dane są dostępne tylko do odczytu; nie można tworzyć ani zmieniać faktur i innych danych studia.</p>
            {role === "owner" ? <a href="/billing" className="underline">Przejdź do rozliczeń</a> : <p>Poproś właściciela studia o sprawdzenie abonamentu.</p>}
          </div>}
          {children}
        </main>
      </div>
      <TabBar />
      <GlobalSearch studioId={context.studioId} />
    </div>
  );
}
