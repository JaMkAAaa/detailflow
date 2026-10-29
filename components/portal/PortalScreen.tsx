import type { ReactNode } from "react";
import type { OrderStatus } from "@/lib/db/generated/client";
import { LogoMark } from "../brand/Logo";
import { EmptyState } from "../states";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";

export type PortalOrder = {
  number: string;
  customerName: string;
  vehicle: { make: string; model: string; plate: string };
  status: OrderStatus;
  stage: number;
  pickupAt: Date;
  totalGross: string;
  service: string;
  updatedAt: Date;
};
type Studio = { name: string; phone: string | null; address: string | null };
const dateTime = (date: Date) => new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
}).format(date);
const statusBadge = { accepted: "accepted", in_progress: "in-progress", ready_for_pickup: "ready-for-pickup", completed: "completed", canceled: "error" } as const;
const stageNames = ["Przyjęcie i mycie", "Korekta lakieru", "Ceramika i kontrola"];

function PortalShell({ children, studio }: { children: ReactNode; studio?: Studio }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-5 px-5 py-6">
      {studio && (
        <header className="relative flex min-h-11 items-center gap-2">
          <LogoMark size={24} />
          <p className="flex-1 text-df-strong">{studio.name}</p>
          {studio.phone && <details className="group">
            <summary aria-label="Kontakt ze studiem" className="flex size-11 cursor-pointer list-none items-center justify-end font-semibold text-df-muted [&::-webkit-details-marker]:hidden">•••</summary>
            <div className="absolute right-0 top-full z-10 flex w-56 flex-col gap-3 rounded-xl border border-df-line bg-df-panel p-4 shadow-xl">
              <a href={`tel:${studio.phone}`}>Zadzwoń do studia</a>
            </div>
          </details>}
        </header>
      )}
      {children}
    </main>
  );
}

export function PortalStatus({ studio, order }: { studio: Studio; order: PortalOrder }) {
  const current = Math.min(3, Math.max(1, order.stage));
  const finished = order.status === "ready_for_pickup" || order.status === "completed";
  const canceled = order.status === "canceled";
  const started = order.status !== "accepted" && !canceled;
  return (
    <PortalShell studio={studio}>
      <div className="flex min-h-[73px] flex-col gap-1">
        <h1 className="text-df-headline">Cześć, {order.customerName.split(" ")[0]}.</h1>
        <p className="text-df-body text-df-muted">{canceled ? "Zlecenie zostało anulowane." : "Twoje auto jest w dobrych rękach."}</p>
      </div>
      <section aria-label="Twoje auto" className="flex flex-col gap-3 rounded-xl bg-df-panel p-4">
        <h2 className="text-df-section">{order.vehicle.make} {order.vehicle.model}</h2>
        <p className="text-df-label text-df-muted">{order.vehicle.plate} · Zlecenie #{order.number}</p>
      </section>
      <section aria-labelledby="portal-progress" className="flex min-h-[255px] flex-col gap-3 rounded-xl bg-df-panel p-4">
        <div className="flex min-h-7 items-start justify-between gap-2">
          <h2 id="portal-progress" className="text-df-section">Postęp prac</h2>
          <Badge variant={statusBadge[order.status]}>{canceled ? "Anulowane" : undefined}</Badge>
        </div>
        <ol aria-label="Etapy zlecenia" className="flex flex-col gap-3">
          {stageNames.map((name, index) => {
            const done = !canceled && (finished || (started && index + 1 < current));
            const active = started && !finished && index + 1 === current;
            return <li key={name} aria-current={active ? "step" : undefined} className="flex min-h-12 flex-col gap-1 text-df-muted">
              <p className={`text-df-strong ${active ? "text-df-lime" : ""}`}><span aria-hidden="true">{done ? "✓" : active ? "●" : "○"}  </span>{name}</p>
              <p className="text-df-label">{canceled ? "Zlecenie anulowane" : done ? "Zakończono" : active ? "W trakcie" : "Oczekuje"}</p>
            </li>;
          })}
        </ol>
      </section>
      {!canceled && <section aria-label="Planowany odbiór" className="flex min-h-[114px] flex-col gap-2 rounded-xl bg-df-lime-dark p-4">
        <h2 className="text-df-label text-df-lime">{order.status === "completed" ? "ZLECENIE ZAKOŃCZONE" : "PLANOWANY ODBIÓR"}</h2>
        <p className="text-df-section">{dateTime(order.pickupAt)}</p>
        {studio.address && <p className="text-df-label text-df-muted">{studio.address}</p>}
      </section>}
      <section aria-labelledby="portal-quote" className="flex min-h-[110px] flex-col gap-2 rounded-xl bg-df-panel p-4">
        <div className="flex min-h-7 justify-between gap-2 text-df-section">
          <h2 id="portal-quote">Kwota brutto</h2>
          <p className="whitespace-nowrap">{order.totalGross.replace(".", ",")} zł</p>
        </div>
        <p className="text-df-label text-df-muted">{order.service}</p>
      </section>
      {studio.phone && <a href={`tel:${studio.phone}`} className={buttonVariants({ className: "min-h-11 w-full text-df-label hover:bg-df-green" })}>Zadzwoń do studia</a>}
      <p className="text-df-label text-df-muted">Ostatnia aktualizacja: {dateTime(order.updatedAt)}</p>
    </PortalShell>
  );
}

export function PortalExpired() {
  return <PortalShell>
    <div className="my-auto rounded-xl bg-df-panel">
      <EmptyState headingLevel={1} title="Ten link już wygasł"
        description="Ten link jest nieważny lub już wygasł. Skontaktuj się ze studiem, które go wysłało, i poproś o nowy link do statusu zlecenia."
        icon={<div className="flex size-16 items-center justify-center rounded-full bg-df-retry-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/portal/expired-link.svg" width={28} height={28} alt="" />
        </div>} />
    </div>
  </PortalShell>;
}
