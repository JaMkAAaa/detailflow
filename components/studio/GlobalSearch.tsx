"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GlobalSearchResult } from "@/src/server/search/global";
import { Button } from "@/components/ui/button";

const openEvent = "detailflow:open-global-search";
const labels: Record<GlobalSearchResult["type"], string> = {
  client: "Klient", vehicle: "Auto", order: "Zlecenie", invoice: "Faktura",
};

export function GlobalSearchTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(openEvent))}
      aria-label="Szukaj klienta, auta, zlecenia lub faktury"
      className={compact
        ? "flex min-h-11 w-full items-center gap-3 rounded-xl bg-df-panel px-4 text-left text-df-body text-df-text"
        : "flex h-10 w-[354px] shrink-0 items-center gap-3 rounded-md text-left text-df-body text-df-muted hover:bg-df-panel"}
    >
      <span aria-hidden="true">⌕</span>
      <span className="flex-1">Szukaj klienta, auta, zlecenia lub faktury…</span>
      {!compact && <kbd className="font-sans">⌘K</kbd>}
    </button>
  );
}

export function GlobalSearch({ studioId }: { studioId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const openPalette = () => setOpen(true);
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(openEvent, openPalette);
    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener(openEvent, openPalette);
      window.removeEventListener("keydown", onShortcut);
    };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      input.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setState("loading");
      try {
        const response = await fetch(`/api/studios/${encodeURIComponent(studioId)}/search?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const value: unknown = await response.json();
        if (!response.ok || !Array.isArray(value)) throw new Error("Nie udało się wyszukać danych.");
        setResults(value as GlobalSearchResult[]);
        setState("ready");
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setState("error");
      }
    }, 180);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, retry, studioId]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="global-search-title"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === dialog.current) close(); }}
      className="fixed inset-0 m-auto max-h-[calc(100%-32px)] w-[600px] max-w-[calc(100%-32px)] overflow-hidden rounded-2xl border border-df-line bg-df-panel p-0 text-df-text shadow-xl backdrop:bg-black/60"
    >
      <div className="border-b border-df-line p-4">
        <label id="global-search-title" htmlFor="global-search-input" className="sr-only">Szukaj w aktywnym studiu</label>
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl text-df-muted">⌕</span>
          <input
            ref={input}
            id="global-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Klient, auto, zlecenie lub faktura…"
            aria-label="Szukaj w aktywnym studiu"
            className="h-11 min-w-0 flex-1 bg-transparent text-df-section placeholder:text-df-muted"
          />
          <kbd className="rounded border border-df-line px-2 py-1 text-xs text-df-muted">Esc</kbd>
        </div>
      </div>
      <div aria-live="polite" className="max-h-[min(60dvh,480px)] overflow-y-auto p-4">
        {!query.trim() ? (
          <p className="py-8 text-center text-df-body text-df-muted">Wpisz nazwę klienta, numer rejestracyjny, numer zlecenia lub faktury.</p>
        ) : query.trim().length < 2 ? (
          <p className="py-8 text-center text-df-body text-df-muted">Wpisz co najmniej 2 znaki.</p>
        ) : state === "loading" ? (
          <p role="status" className="py-8 text-center text-df-body text-df-muted">Wyszukiwanie…</p>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <p role="alert" className="text-df-body text-df-error">Nie udało się wyszukać danych.</p>
            <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Spróbuj ponownie</Button>
          </div>
        ) : state === "ready" && results.length === 0 ? (
          <p className="py-8 text-center text-df-body text-df-muted">Brak wyników dla „{query.trim()}”.</p>
        ) : state === "ready" ? (
          <ul className="space-y-1">
            {results.map((result, index) => (
              <li key={`${result.type}:${result.href}:${index}`}>
                <Link
                  href={result.href}
                  onClick={close}
                  className="flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 hover:bg-df-raised"
                >
                  <span className="w-20 shrink-0 text-xs font-semibold uppercase text-df-muted">{labels[result.type]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-df-label font-semibold">{result.title}</span>
                    <span className="block truncate text-df-body text-df-muted">{result.subtitle}</span>
                  </span>
                  <span aria-hidden="true" className="text-df-muted">↗</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </dialog>
  );
}
