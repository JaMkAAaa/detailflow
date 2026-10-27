import type { ReactNode } from "react";
import { LogoMark } from "../brand/Logo";
import { EmptyState } from "../states";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { formatPln } from "../pulpit/demo";
import { portalDemo } from "./demo";

const contact = portalDemo.studio;
const requestLink = `mailto:${contact.email}?subject=${encodeURIComponent("Prośba o nowy link do statusu zlecenia")}`;

function PortalShell({ children, knownStudio = true }: { children: ReactNode; knownStudio?: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[390px] flex-col gap-5 px-5 py-6">
      {knownStudio && (
        <header className="relative flex min-h-11 items-center gap-2">
          <LogoMark size={24} />
          <p className="flex-1 text-df-strong">{contact.name}</p>
          <details className="group">
            <summary aria-label="Kontakt ze studiem" className="flex size-11 cursor-pointer list-none items-center justify-end font-semibold text-df-muted [&::-webkit-details-marker]:hidden">•••</summary>
            <div className="absolute right-0 top-full z-10 flex w-56 flex-col gap-3 rounded-xl border border-df-line bg-df-panel p-4 shadow-xl">
              <a href={`tel:${contact.phone}`}>Zadzwoń do studia</a>
              <a href={requestLink}>Poproś o nowy link</a>
            </div>
          </details>
        </header>
      )}
      {children}
    </main>
  );
}

export function PortalStatus() {
  return (
    <PortalShell>
      <div className="flex min-h-[73px] flex-col gap-1">
        <h1 className="text-df-headline">Cześć, {portalDemo.customerFirstName}.</h1>
        <p className="text-df-body text-df-muted">Twoje auto jest w dobrych rękach.</p>
      </div>
      <section aria-label="Twoje auto" className="flex min-h-[232px] flex-col gap-3 rounded-xl bg-df-panel p-4">
        {/* Exact same image bytes as Figma P-01, reused from D-04. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/orders/porsche-panamera.jpg" alt="Czarne Porsche Panamera" width={318} height={140} className="h-[140px] w-full rounded-[10px] object-cover" />
        <h2 className="text-df-section">{portalDemo.vehicle}</h2>
        <p className="text-df-label text-df-muted">{portalDemo.plate} · Zlecenie #{portalDemo.orderNumber}</p>
      </section>
      <section aria-labelledby="portal-progress" className="flex min-h-[255px] flex-col gap-3 rounded-xl bg-df-panel p-4">
        <div className="flex min-h-7 items-start justify-between gap-2">
          <h2 id="portal-progress" className="text-df-section">Postęp prac</h2>
          <Badge variant="in-progress" />
        </div>
        <ol aria-label="Etapy zlecenia" className="flex flex-col gap-3">
          {portalDemo.stages.map((stage) => (
            <li key={stage.name} aria-current={stage.state === "current" ? "step" : undefined} className="flex min-h-12 flex-col gap-1 text-df-muted">
              <p className={`text-df-strong ${stage.state === "current" ? "text-df-lime" : ""}`}><span aria-hidden="true">{stage.symbol}  </span>{stage.name}</p>
              <p className="text-df-label">{stage.note}</p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-label="Planowany odbiór" className="flex min-h-[114px] flex-col gap-2 rounded-xl bg-df-lime-dark p-4">
        <h2 className="text-df-label text-df-lime">PLANOWANY ODBIÓR</h2>
        <p className="text-df-section">Jutro, 25 października</p>
        <p className="text-df-label text-df-muted">Godzina 16:00 · ul. Rzemieślnicza 12</p>
      </section>
      <section aria-labelledby="portal-quote" className="flex min-h-[110px] flex-col gap-2 rounded-xl bg-df-panel p-4">
        <div className="flex min-h-7 justify-between gap-2 text-df-section">
          <h2 id="portal-quote">Wycena</h2>
          <p className="whitespace-nowrap">{formatPln(portalDemo.grossPln)}</p>
        </div>
        <p className="text-df-label text-df-green">✓ Zaakceptowano 24.10 o 08:04</p>
        <p className="text-df-label text-df-muted">Korekta lakieru + powłoka ceramiczna</p>
      </section>
      <a href={`tel:${contact.phone}`} className={buttonVariants({ className: "min-h-11 w-full text-df-label hover:bg-df-green" })}>Zadzwoń do studia</a>
      <p className="text-df-label text-df-muted">Ostatnia aktualizacja: dziś, 11:30</p>
    </PortalShell>
  );
}

export function PortalExpired({ knownStudio }: { knownStudio: boolean }) {
  return (
    <PortalShell knownStudio={knownStudio}>
      <div className="my-auto rounded-xl bg-df-panel">
        <EmptyState
          headingLevel={1}
          title="Ten link już wygasł"
          description={knownStudio
            ? "Ze względów bezpieczeństwa linki do statusu działają 30 dni. Poproś studio o nowy link, wystarczy jedno kliknięcie."
            : "Ten link jest nieważny lub już wygasł. Skontaktuj się ze studiem, które go wysłało, i poproś o nowy link do statusu zlecenia."}
          icon={
            <div className="flex size-16 items-center justify-center rounded-full bg-df-retry-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/portal/expired-link.svg" width={28} height={28} alt="" />
            </div>
          }
          actions={knownStudio ? <>
            <a href={`tel:${contact.phone}`} className={buttonVariants({ variant: "secondary", className: "px-4 hover:bg-df-hover" })}>Zadzwoń do studia</a>
            <a href={requestLink} className={buttonVariants({ className: "px-4 hover:bg-df-green" })}>Poproś o nowy link</a>
          </> : undefined}
        />
      </div>
    </PortalShell>
  );
}
