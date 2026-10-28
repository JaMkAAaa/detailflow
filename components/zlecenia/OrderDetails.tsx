"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderDetailsData } from "./order-types";
import { HistoryTab, IntakeTab, Overview, PhotosTab } from "./panels";
import { orderTabs, type OrderTab } from "./tabs";

export function OrderDetails({ data, studioId, initialTab = "przeglad", onAdvanced }: { data: OrderDetailsData; studioId: string; initialTab?: OrderTab; onAdvanced?: () => void }) {
  const [tab, setTab] = useState<OrderTab>(initialTab);
  const [notice, setNotice] = useState({ title: "", description: "" });
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = data.stages.find((stage) => stage.state === "current");
  const counts: Partial<Record<OrderTab, number>> = { zdjecia: data.photos.length, "stan-auta": data.intake.damages.length };

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

  function showNotice(title: string, description: string) {
    setNotice({ title, description });
    dialog.current?.showModal();
  }

  function selectTab(next: OrderTab, focus = false) {
    setTab(next);
    // Keeps the tab shareable and survives a reload without a navigation.
    const url = new URL(window.location.href);
    if (next === "przeglad") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
    if (focus) tabRefs.current[orderTabs.findIndex((item) => item.id === next)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = orderTabs.length - 1;
    const target = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectTab(orderTabs[target]!.id, true);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-df-headline">{data.vehicle}</h1>
          <p className="mt-1 text-df-body text-df-muted">
            Zlecenie #{data.number} / {data.customer.name} / {data.plate}
          </p>
        </div>
        {current && data.status === "in-progress" && (
          <Button
            className="w-[250px]"
            disabled={advancing}
            onClick={advance}
          >
            {advancing ? "Zapisywanie…" : `Zakończ: ${current.name}`}
          </Button>
        )}
      </div>
      {advanceError && <p role="alert" className="text-df-body text-df-error">{advanceError}</p>}

      <div className="flex items-start gap-3">
        <div role="tablist" aria-label="Sekcje zlecenia" className="flex items-start gap-3">
          {orderTabs.map(({ id, label }, index) => {
            const selected = tab === id;
            const count = counts[id];
            return (
              <button
                key={id}
                ref={(node) => { tabRefs.current[index] = node; }}
                type="button"
                role="tab"
                id={`order-tab-${id}`}
                aria-selected={selected}
                aria-controls={`order-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "flex h-7 items-center gap-2 rounded-md border px-2.5 text-df-label",
                  selected ? "border-df-muted bg-df-line text-df-text" : "border-transparent bg-df-raised text-df-muted hover:text-df-text",
                )}
              >
                {label}
                {count !== undefined && <span>{count}</span>}
              </button>
            );
          })}
        </div>
        <Button
          variant="secondary"
          className="ml-auto h-10 w-[180px] text-df-label"
          onClick={() => showNotice("Link dla klienta — wkrótce", "Link do portalu klienta będzie dostępny razem z portalem. Surowy token pojawi się tylko w adresie URL.")}
        >
          Link dla klienta ↗
        </Button>
      </div>

      {orderTabs.map(({ id }) => (
        <div key={id} role="tabpanel" id={`order-panel-${id}`} aria-labelledby={`order-tab-${id}`} hidden={tab !== id}>
          {tab === id && id === "przeglad" && <Overview data={data} notice={showNotice} onOpenTab={selectTab} />}
          {tab === id && id === "zdjecia" && <PhotosTab data={data} notice={showNotice} />}
          {tab === id && id === "stan-auta" && <IntakeTab data={data} />}
          {tab === id && id === "historia" && <HistoryTab data={data} />}
        </div>
      ))}

      <dialog
        ref={dialog}
        aria-labelledby="order-dialog-title"
        aria-describedby="order-dialog-description"
        className="fixed inset-0 m-auto w-[440px] max-w-[calc(100%-32px)] rounded-xl border border-df-line bg-df-panel p-6 text-df-text backdrop:bg-black/60"
      >
        <h2 id="order-dialog-title" className="text-df-section">{notice.title}</h2>
        <p id="order-dialog-description" className="mt-3 text-df-body text-df-muted">{notice.description}</p>
        <form method="dialog" className="mt-5 flex justify-end">
          <Button type="submit" variant="secondary">Zamknij</Button>
        </form>
      </dialog>
    </div>
  );
}
