"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPln } from "@/lib/format-pln";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { NoticeSheet, type Notice } from "@/components/studio/NoticeSheet";
import { cn } from "@/lib/utils";
import type { OrderDetailsData, StageState } from "./order-types";
import { pluralPhotos } from "./panels";

const phoneHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const actionClass = "flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[14px] bg-df-panel py-3 text-df-label text-df-text";
const roundButton = "flex size-11 items-center justify-center rounded-full bg-black/60 text-df-text backdrop-blur-sm";

function StageMarker({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-df-lime-dark text-df-lime">
        <MaskIcon name="check" size={14} />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="flex size-6 items-center justify-center rounded-full bg-df-lime">
        <span className="size-2 rounded-full bg-df-bg" />
      </span>
    );
  }
  return <span className="size-6 rounded-full border border-df-line" />;
}

/**
 * M-04 — szczegóły zlecenia w układzie telefonu. Te same dane co D-04 (`OrderDetailsData`):
 * postęp 4 etapów studia, wycena, kontakt. Zapis etapu, link i zdjęcia otwierają sheet „wkrótce”.
 */
export function MobileOrderDetails({ data, studioId, onAdvanced }: { data: OrderDetailsData; studioId: string; onAdvanced?: () => void }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const current = data.stages.find((stage) => stage.state === "current");
  const done = data.stages.filter((stage) => stage.state === "done").length;
  const cover = [...data.photos].reverse().find((photo) => photo.src);
  const soon = (title: string, description: string) => setNotice({ title, description });

  async function advance() {
    setAdvancing(true); setAdvanceError("");
    try {
      const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/orders/${encodeURIComponent(data.id)}/advance`, { method: "POST" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Nie udało się zmienić etapu.");
      if (onAdvanced) onAdvanced(); else window.location.reload();
    } catch (cause) { setAdvanceError(cause instanceof Error ? cause.message : "Nie udało się zmienić etapu."); }
    finally { setAdvancing(false); }
  }

  return (
    // Pełna szerokość i góra ekranu: wyłamanie z paddingu `main` (layout studia).
    <div className="-mx-4 -mt-4 flex flex-col gap-4">
      <div className="relative h-[300px] overflow-hidden bg-df-raised">
        {cover?.src && <Image src={cover.src} alt={`${data.vehicle} — ${cover.caption.toLowerCase()}`} fill priority sizes="100vw" className="object-cover" />}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-df-bg/55 via-df-bg/0 via-45% to-df-bg" />
        <div className="absolute inset-x-0 top-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between px-4">
          <Link href="/orders" aria-label="Wróć do zleceń" className={roundButton}>
            <MaskIcon name="back" size={20} />
          </Link>
          <button type="button" disabled title="Więcej — wkrótce" aria-label="Więcej — wkrótce" className={cn(roundButton, "cursor-not-allowed")}>
            <MaskIcon name="more" size={20} />
          </button>
        </div>
        <p className="absolute right-4 bottom-[50px] flex items-center gap-1.5 rounded-full bg-df-bg/70 px-2.5 py-[5px] text-df-label font-semibold">
          <MaskIcon name="camera" size={14} />
          {pluralPhotos(data.photos.length)}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <p className="flex-1 text-df-body font-medium text-df-muted">#{data.number}</p>
            <Badge variant={data.status} className="h-[25px]">{data.status === "error" ? "Anulowane" : undefined}</Badge>
          </div>
          <h1 className="text-[26px] leading-[1.15] font-bold">{data.vehicle}</h1>
          <p className="text-df-body text-df-muted">
            {data.plate} · {data.bay}
          </p>
        </header>

        <div className="flex gap-2">
          {data.customer.phone && <a href={phoneHref(data.customer.phone)} aria-label={`Zadzwoń do klienta: ${data.customer.name}, ${data.customer.phone}`} className={actionClass}>
            <MaskIcon name="phone" size={20} className="text-df-lime" />
            Zadzwoń
          </a>}
          {data.customer.id && <Link href={`/customers/${data.customer.id}`} className={actionClass}>
            <MaskIcon name="link" size={20} className="text-df-lime" />
            Klient
          </Link>}
          <button
            type="button"
            onClick={() => soon("Link dla klienta — wkrótce", "Link do portalu klienta będzie dostępny razem z portalem. Surowy token pojawi się tylko w adresie URL.")}
            className={actionClass}
          >
            <MaskIcon name="link" size={20} className="text-df-lime" />
            Link
          </button>
          <button type="button" onClick={() => soon("Zdjęcie — wkrótce", "Dodawanie zdjęć z aparatu będzie dostępne wkrótce.")} className={actionClass}>
            <MaskIcon name="camera" size={20} className="text-df-lime" />
            Zdjęcie
          </button>
        </div>

        <section aria-labelledby="m-progress" className="rounded-[18px] bg-df-panel p-4">
          <div className="flex items-center gap-2.5 pb-2.5">
            <h2 id="m-progress" className="flex-1 text-base font-semibold">
              Postęp prac
            </h2>
            <p className="text-df-body font-medium text-df-muted">
              {done + (current ? 1 : 0)} z {data.stages.length}
            </p>
          </div>
          <ol>
            {data.stages.map((stage, index) => {
              const last = index === data.stages.length - 1;
              return (
                <li key={stage.name} aria-current={stage.state === "current" ? "step" : undefined} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <StageMarker state={stage.state} />
                    {!last && <span aria-hidden="true" className={cn("h-[26px] w-0.5", stage.state === "done" ? "bg-df-lime" : "bg-df-line")} />}
                  </div>
                  <div className={cn("flex flex-col gap-0.5 pt-0.5", stage.state === "todo" && "text-df-muted")}>
                    <p className={cn("text-[15px]", stage.state === "current" ? "font-semibold text-df-text" : stage.state === "done" ? "font-medium text-df-text" : "font-medium")}>
                      {stage.name}
                      <span className="sr-only"> — {stage.state === "done" ? "zakończony" : stage.state === "current" ? "w toku" : "do zrobienia"}</span>
                    </p>
                    <p className={cn("text-df-label font-normal", stage.state === "current" ? "text-df-lime" : "text-df-muted")}>{stage.note}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="m-quote" className="flex flex-col gap-2.5 rounded-[18px] bg-df-panel p-4">
          <div className="flex items-center gap-2.5">
            <h2 id="m-quote" className="flex-1 text-base font-semibold">
              Wycena
            </h2>
            <p className="text-df-label font-semibold text-df-lime">✓ {data.quote.status}</p>
          </div>
          {data.quote.items.map((item) => (
            <div key={item.name} className="flex items-center gap-2.5 text-[14px]">
              <p className="flex-1 text-df-muted">{item.name}</p>
              <p className="font-medium whitespace-nowrap">{formatPln(item.grossPln)}</p>
            </div>
          ))}
          <div className="h-px bg-df-line" />
          <div className="flex items-center gap-2.5">
            <p className="flex-1 text-[15px] font-semibold">Razem brutto</p>
            <p className="text-xl font-bold whitespace-nowrap">{formatPln(data.quote.totalGrossPln)}</p>
          </div>
        </section>
      </div>

      {current && data.status === "in-progress" && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-df-line bg-df-side px-4 pt-3 pb-[max(1.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={advancing}
            onClick={advance}
            className="h-12 w-full rounded-[14px] bg-df-lime px-[18px] text-df-body font-semibold text-df-bg"
          >
            {advancing ? "Zapisywanie…" : `Zakończ: ${current.name}`}
          </button>
          {advanceError && <p role="alert" className="mt-2 text-df-body text-df-error">{advanceError}</p>}
        </div>
      )}

      <NoticeSheet notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
