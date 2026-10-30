"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GlobalSearchResult } from "@/src/server/search/global";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const openEvent = "detailflow:open-global-search";
const RECENT_LIMIT = 3;
const TYPE_ORDER: GlobalSearchResult["type"][] = ["client", "vehicle", "order", "invoice"];
const labels: Record<GlobalSearchResult["type"], string> = {
  client: "Klienci",
  vehicle: "Auta",
  order: "Zlecenia",
  invoice: "Faktury",
};
const tileStyles: Record<GlobalSearchResult["type"], string> = {
  client: "bg-df-blue/10 text-df-blue",
  vehicle: "bg-df-amber/10 text-df-amber",
  order: "bg-df-lime/10 text-df-lime",
  invoice: "bg-df-green/10 text-df-green",
};
const examples = [
  { value: "WA 12345", invoice: false },
  { value: "Kowalski", invoice: false },
  { value: "DF-0248", invoice: false },
  { value: "FV/41", invoice: true },
];
const quickActions = [
  { label: "Nowe zlecenie", href: "/orders?new=1" },
  { label: "Nowa wycena", href: "/quotes/new" },
  { label: "Dodaj klienta", href: "/customers/new" },
];

type RecentSearch = GlobalSearchResult & { savedAt: number };
type SearchRow = GlobalSearchResult & { savedAt?: number };
type SearchState = "idle" | "loading" | "ready" | "error";
type Filter = "all" | GlobalSearchResult["type"];

function recentKey(studioId: string) {
  return `detailflow:global-search:recent:${studioId}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, term }: { text: string; term: string }) {
  const needle = term.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(needle)})`, "ig"));
  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === needle.toLowerCase() ? (
          <mark key={`${part}:${index}`} className="rounded-[3px] bg-df-lime/15 px-px text-df-lime">
            {part}
          </mark>
        ) : (
          <span key={`${part}:${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

function plural(count: number) {
  if (count === 1) return "1 wynik";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return `${count} wyniki`;
  return `${count} wyników`;
}

function countLabel(visible: number, total: number) {
  return visible === total ? plural(visible) : `${visible} z ${total} wyników`;
}

function relativeTime(savedAt: number) {
  const date = new Date(savedAt);
  const now = new Date();
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  const time = new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (days <= 0) return `dziś, ${time}`;
  if (days === 1) return "wczoraj";
  if (days < 7) return `${days} dni temu`;
  return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" }).format(date);
}

function isResultType(value: string): value is GlobalSearchResult["type"] {
  return (TYPE_ORDER as string[]).includes(value);
}

function readRecent(studioId: string, canInvoice: boolean): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(recentKey(studioId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: RecentSearch[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (typeof item.type !== "string" || !isResultType(item.type)) continue;
      if (item.type === "invoice" && !canInvoice) continue;
      if (
        typeof item.title !== "string" ||
        typeof item.subtitle !== "string" ||
        typeof item.href !== "string" ||
        typeof item.savedAt !== "number"
      ) continue;
      items.push({ type: item.type, title: item.title, subtitle: item.subtitle, href: item.href, savedAt: item.savedAt });
    }
    return items.sort((a, b) => b.savedAt - a.savedAt).slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

function writeRecent(studioId: string, items: RecentSearch[]) {
  try {
    window.localStorage.setItem(recentKey(studioId), JSON.stringify(items));
  } catch {
    // Storage can be unavailable in private mode; recents are an enhancement.
  }
}

function groupResults(results: SearchRow[]) {
  let offset = 0;
  const groups: { type: GlobalSearchResult["type"]; items: SearchRow[]; offset: number }[] = [];
  for (const type of TYPE_ORDER) {
    const items = results.filter((item) => item.type === type);
    if (!items.length) continue;
    groups.push({ type, items, offset });
    offset += items.length;
  }
  return groups;
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="m12.5 12.5 4 4" />
    </svg>
  );
}

function TypeIcon({ type }: { type: GlobalSearchResult["type"] }) {
  if (type === "client") {
    return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <circle cx="10" cy="6.5" r="3" />
        <path d="M4.5 16.5c.6-3 2.7-4.5 5.5-4.5s4.9 1.5 5.5 4.5" />
      </svg>
    );
  }
  if (type === "vehicle") {
    return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M3.5 12.5 5 7.8c.2-.7.9-1.3 1.7-1.3h6.6c.8 0 1.5.6 1.7 1.3l1.5 4.7" />
        <path d="M3.5 12.5h13v3.2h-2.2v-1.2H5.7v1.2H3.5z" />
        <circle cx="6.4" cy="14.6" r=".9" />
        <circle cx="13.6" cy="14.6" r=".9" />
      </svg>
    );
  }
  if (type === "invoice") {
    return (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M5 3.5h10v14l-2.5-1.5L10 17.5 7.5 16 5 17.5z" />
        <path d="M7.5 7h5M7.5 10h5" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="3.5" width="12" height="14" rx="2" />
      <path d="M7 7.5h6M7 10.5h6M7 13.5h3.5" />
    </svg>
  );
}

function EnterGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.5 3v5.5a2 2 0 0 1-2 2H4" />
      <path d="m6.5 8 -2.5 2.5L6.5 13" />
    </svg>
  );
}

function StoreGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 6.2V13h11V6.2" />
      <path d="M1.5 6.2 3 2.8h10l1.5 3.4a1.9 1.9 0 0 1-3.4 1.4 1.9 1.9 0 0 1-3.2 0 1.9 1.9 0 0 1-3.2 0 1.9 1.9 0 0 1-3.2-1.4Z" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M10 3.5 17 16H3z" />
      <path d="M10 8v3.5M10 13.8v.2" />
    </svg>
  );
}

function EmptyGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.25" />
      <path d="m12.5 12.5 4 4" />
      <path d="M6.5 8.5h4" />
    </svg>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-df-line bg-white/[0.025] px-1 text-[9px] font-medium text-df-muted">
      {children}
    </kbd>
  );
}

function ResultRow({
  row,
  index,
  term,
  active,
  savedAt,
  onSelect,
  onOpen,
  rowRef,
}: {
  row: SearchRow;
  index: number;
  term: string;
  active: boolean;
  savedAt?: number;
  onSelect: () => void;
  onOpen: () => void;
  rowRef: (node: HTMLAnchorElement | null) => void;
}) {
  const accessibleLabel = savedAt
    ? `${row.title}, ${row.subtitle}, ${relativeTime(savedAt)}`
    : `${row.title}, ${row.subtitle}`;

  return (
    <Link
      ref={rowRef}
      href={row.href}
      id={`global-search-option-${index}`}
      role="option"
      aria-label={accessibleLabel}
      aria-selected={active}
      tabIndex={-1}
      onMouseEnter={onSelect}
      onClick={onOpen}
      className={cn(
        "group flex min-h-14 items-center gap-3 rounded-[10px] border border-transparent px-2.5 py-[7px] text-df-text no-underline max-lg:min-h-[58px]",
        active
          ? "border-df-lime/20 bg-[#262b2f] shadow-[inset_2px_0_0_var(--df-lime)]"
          : "hover:bg-df-raised",
      )}
    >
      <span
        className={cn(
          "grid size-[34px] shrink-0 place-items-center rounded-[9px] max-lg:size-9",
          active ? "bg-df-lime-dark text-df-lime" : tileStyles[row.type],
        )}
      >
        <TypeIcon type={row.type} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold leading-[1.35] max-lg:text-[13px]">
          <Highlight text={row.title} term={term} />
        </span>
        <span className="mt-0.5 block truncate text-[11px] leading-[1.35] text-df-muted">
          <Highlight text={row.subtitle} term={term} />
          {savedAt ? <span> · {relativeTime(savedAt)}</span> : null}
        </span>
      </span>
      <span
        className={cn("flex shrink-0 items-center text-df-muted transition-opacity", active ? "opacity-75" : "opacity-0")}
        aria-hidden="true"
      >
        <EnterGlyph />
      </span>
    </Link>
  );
}

function GroupHeader({ type, count, id }: { type: GlobalSearchResult["type"]; count: number; id: string }) {
  return (
    <div className="flex items-center justify-between px-2.5 pb-1 pt-2.5 text-[9.5px] font-bold uppercase tracking-[.095em] text-df-muted">
      <span id={id}>{labels[type]}</span>
      <span className="text-[10px] font-semibold tracking-normal text-df-muted/80">{count}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="px-2.5 py-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 px-2.5 py-2">
          <span className="size-[34px] shrink-0 animate-pulse rounded-[9px] bg-df-raised motion-reduce:animate-none" />
          <span className="flex flex-1 flex-col gap-[7px]">
            <span className="block h-2 w-[38%] animate-pulse rounded bg-df-raised motion-reduce:animate-none" />
            <span className="block h-1.5 w-[62%] animate-pulse rounded bg-df-raised motion-reduce:animate-none" />
          </span>
        </div>
      ))}
    </div>
  );
}

function SearchMessage({
  icon,
  title,
  children,
  action,
  error = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  error?: boolean;
}) {
  return (
    <div className="flex min-h-[332px] flex-col items-center justify-center gap-[7px] px-6 py-11 text-center max-lg:min-h-[240px]">
      <span className={cn("mb-0.5 grid size-11 place-items-center rounded-xl", error ? "bg-df-error-surface text-df-error" : "bg-df-raised text-df-muted")}>
        {icon}
      </span>
      <h3 className="text-[14px] font-semibold tracking-[-.1px]">{title}</h3>
      <p className="max-w-[340px] text-[11.5px] leading-[1.55] text-df-muted">{children}</p>
      {action ? <div className="mt-2.5 flex gap-2">{action}</div> : null}
    </div>
  );
}

export function GlobalSearchTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(openEvent))}
      aria-label="Szukaj klienta, auta, zlecenia lub faktury"
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      className={cn(
        "flex items-center gap-3 text-left text-df-body",
        compact
          ? "min-h-11 w-full rounded-xl bg-df-panel px-4 text-df-text"
          : "h-10 w-[354px] shrink-0 rounded-lg text-df-muted hover:bg-df-panel",
      )}
    >
      <SearchGlyph className="size-[18px] shrink-0" />
      <span className="flex-1 truncate">Szukaj klienta, auta, zlecenia lub faktury…</span>
      {!compact && <kbd className="font-sans text-[11px] text-df-muted">⌘K</kbd>}
    </button>
  );
}

export function GlobalSearch({
  studioId,
  studioName = "Aktywne studio",
  canInvoice = true,
}: {
  studioId: string;
  studioName?: string;
  canInvoice?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [state, setState] = useState<SearchState>("idle");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState(0);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  const term = query.trim();
  const visibleResults = useMemo(
    () => (filter === "all" ? results : results.filter((result) => result.type === filter)),
    [filter, results],
  );
  const groups = useMemo(() => groupResults(visibleResults), [visibleResults]);
  const groupedCounts = useMemo(() => groupResults(results), [results]);
  const rows: SearchRow[] = state === "ready" && term.length >= 2 ? visibleResults : state === "idle" && term.length < 2 ? recent : [];

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
    setRecent(readRecent(studioId, canInvoice));
  }, [canInvoice, studioId]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (term.length < 2) {
      setResults([]);
      setState("idle");
      return;
    }
    const controller = new AbortController();
    setState("loading");
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/studios/${encodeURIComponent(studioId)}/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        const value: unknown = await response.json();
        if (!response.ok || !Array.isArray(value)) throw new Error("Nie udało się wyszukać danych.");
        if (controller.signal.aborted) return;
        setResults(value as GlobalSearchResult[]);
        setState("ready");
        setSelected(0);
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
  }, [open, query, retry, studioId, term]);

  useEffect(() => {
    if (rows.length && selected > rows.length - 1) setSelected(0);
  }, [rows.length, selected]);

  useEffect(() => {
    if (filter !== "all" && results.length > 0 && !results.some((result) => result.type === filter)) {
      setFilter("all");
    }
  }, [filter, results]);

  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView?.({ block: "nearest" });
  }, [rows.length, selected]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setState("idle");
    setFilter("all");
    setSelected(0);
  }

  function changeQuery(value: string) {
    setQuery(value);
    setFilter("all");
    setSelected(0);
  }

  function chooseFilter(value: Filter) {
    setFilter(value);
    setSelected(0);
    input.current?.focus();
  }

  function remember(result: GlobalSearchResult) {
    const next: RecentSearch[] = [
      { ...result, savedAt: Date.now() },
      ...recent.filter((item) => item.href !== result.href),
    ].slice(0, RECENT_LIMIT);
    setRecent(next);
    writeRecent(studioId, next);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (rows.length) setSelected(Math.min(selected + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(Math.max(selected - 1, 0));
    } else if (event.key === "Home") {
      event.preventDefault();
      setSelected(0);
    } else if (event.key === "End") {
      event.preventDefault();
      if (rows.length) setSelected(rows.length - 1);
    } else if (event.key === "Enter") {
      if (rows.length) {
        event.preventDefault();
        rowRefs.current[selected]?.click();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  const footerLabel =
    state === "loading"
      ? "Szukam w aktywnym studiu…"
      : state === "error"
        ? "Błąd wyszukiwania"
        : term.length === 1
          ? "Wpisz jeszcze 1 znak"
          : studioName;
  const footerCount = countLabel(visibleResults.length, results.length);
  const showCount = state === "ready" && term.length >= 2;
  const showChips = state === "ready" && results.length > 0;

  let content: ReactNode;
  if (state === "loading") {
    content = <Skeleton />;
  } else if (state === "error") {
    content = (
      <SearchMessage
        icon={<AlertGlyph />}
        title="Nie udało się wyszukać"
        error
        action={
          <Button variant="secondary" className="h-[33px] px-3 text-[11.5px]" onClick={() => setRetry((value) => value + 1)}>
            Spróbuj ponownie
          </Button>
        }
      >
        Sprawdź połączenie i spróbuj ponownie. Twoje zapytanie zostało zachowane.
      </SearchMessage>
    );
  } else if (state === "ready" && term.length >= 2 && results.length === 0) {
    content = (
      <SearchMessage
        icon={<EmptyGlyph />}
        title={`Brak wyników dla „${term}”`}
        action={
          <Button
            variant="secondary"
            className="h-[33px] px-3 text-[11.5px]"
            onClick={() => {
              changeQuery("");
              input.current?.focus();
            }}
          >
            Wyczyść zapytanie
          </Button>
        }
      >
        Sprawdź pisownię lub spróbuj numeru rejestracyjnego, np.{" "}
        <strong className="text-df-text">WA 12345</strong>, albo numeru zlecenia{" "}
        <strong className="text-df-text">DF-0248</strong>.
      </SearchMessage>
    );
  } else if (state === "ready" && term.length >= 2 && visibleResults.length === 0) {
    content = (
      <SearchMessage
        icon={<EmptyGlyph />}
        title="Brak wyników w tej kategorii"
        action={
          <Button variant="secondary" className="h-[33px] px-3 text-[11.5px]" onClick={() => chooseFilter("all")}>
            Pokaż wszystkie
          </Button>
        }
      >
        Zmień filtr typu, aby zobaczyć pozostałe wyniki.
      </SearchMessage>
    );
  } else if (state === "ready" && term.length >= 2) {
    content = (
      <div role="listbox" aria-label="Wyniki wyszukiwania">
        {groups.map((group) => (
          <div key={group.type} role="group" aria-labelledby={`global-search-group-${group.type}`}>
            <GroupHeader type={group.type} count={group.items.length} id={`global-search-group-${group.type}`} />
            {group.items.map((row, index) => {
              const rowIndex = group.offset + index;
              return (
                <ResultRow
                  key={`${row.type}:${row.href}:${rowIndex}`}
                  row={row}
                  index={rowIndex}
                  term={term}
                  active={rowIndex === selected}
                  onSelect={() => setSelected(rowIndex)}
                  onOpen={() => {
                    remember(row);
                    close();
                  }}
                  rowRef={(node) => {
                    rowRefs.current[rowIndex] = node;
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  } else {
    content = (
      <div className="px-2.5 pb-1 pt-3">
        {term.length === 1 ? (
          <p className="px-1 pb-2 text-[11.5px] text-df-muted">Wpisz jeszcze 1 znak, aby wyszukać.</p>
        ) : null}
        {recent.length > 0 ? (
          <>
            <div className="flex items-center justify-between px-1 pb-1.5 text-[9.5px] font-bold uppercase tracking-[.095em] text-df-muted">
              <span>Ostatnio otwierane</span>
              <span className="text-[10px] font-medium normal-case tracking-normal text-df-muted/80">w tym studiu</span>
            </div>
            <ul role="listbox" aria-label="Ostatnio otwierane" className="m-0 flex list-none flex-col gap-px p-0">
              {recent.map((row, index) => (
                <li key={`${row.type}:${row.href}`} role="presentation">
                  <ResultRow
                    row={row}
                    index={index}
                    term={term}
                    active={index === selected}
                    savedAt={row.savedAt}
                    onSelect={() => setSelected(index)}
                    onOpen={() => {
                      remember(row);
                      close();
                    }}
                    rowRef={(node) => {
                      rowRefs.current[index] = node;
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="px-1 pb-3 text-df-body text-df-muted">
            Zacznij od nazwiska klienta, numeru rejestracyjnego, numeru zlecenia albo faktury.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          <span className="text-[10.5px] text-df-muted">Przykłady:</span>
          {examples
            .filter((example) => canInvoice || !example.invoice)
            .map((example) => (
              <button
                key={example.value}
                type="button"
                onClick={() => {
                  changeQuery(example.value);
                  input.current?.focus();
                }}
                className="h-7 rounded-[7px] border border-df-line bg-[#1e2225] px-2.5 font-mono text-[11px] text-df-muted hover:border-[#3d4349] hover:bg-df-raised hover:text-df-text"
              >
                {example.value}
              </button>
            ))}
        </div>
        <div className="mx-1 mt-3 flex flex-wrap items-center gap-1.5 border-t border-df-line pt-3">
          <span className="text-[10.5px] text-df-muted">Szybkie akcje</span>
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={close}
              className="inline-flex h-7 items-center rounded-[7px] border border-df-line px-2.5 text-[11px] font-medium text-df-muted hover:border-[#3d4349] hover:bg-df-raised hover:text-df-text"
            >
              + {action.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Szukaj w aktywnym studiu"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={() => {
        if (open) close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
      className="fixed inset-0 m-auto flex max-h-[calc(100dvh-32px)] w-[620px] max-w-[calc(100%-32px)] flex-col overflow-hidden rounded-2xl border border-df-line p-0 text-df-text shadow-2xl backdrop:bg-black/70 max-lg:m-0 max-lg:h-dvh max-lg:max-h-[100dvh] max-lg:w-full max-lg:max-w-none max-lg:rounded-none max-lg:border-0"
      style={{ background: "linear-gradient(180deg, #1c1f23 0%, #1a1d20 100%)" }}
    >
      {state === "loading" ? (
        <div className="absolute inset-x-0 top-0 h-0.5 animate-pulse bg-df-lime/70 motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-df-line px-4">
        <SearchGlyph className="size-[18px] shrink-0 text-df-muted" />
        <input
          ref={input}
          id="global-search-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-activedescendant={rows.length ? `global-search-option-${selected}` : undefined}
          aria-label="Szukaj w aktywnym studiu"
          value={query}
          onChange={(event) => changeQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Klient, auto, zlecenie lub faktura…"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          className="h-[54px] min-w-0 flex-1 bg-transparent text-[15.5px] tracking-[-.1px] text-df-text outline-none placeholder:text-df-muted"
        />
        <button type="button" onClick={close} className="shrink-0 text-df-label text-df-lime lg:hidden">
          Anuluj
        </button>
        <kbd className="hidden h-[22px] shrink-0 items-center rounded-md border border-df-line bg-white/[0.025] px-1.5 text-[10px] font-medium text-df-muted shadow-[0_1px_0_rgba(0,0,0,.25)] lg:inline-flex">
          Esc
        </kbd>
      </div>

      {showChips ? (
        <div
          role="group"
          aria-label="Filtruj typ wyniku"
          className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-df-line px-3.5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            type="button"
            aria-label={`Wszystko (${results.length})`}
            aria-pressed={filter === "all"}
            onClick={() => chooseFilter("all")}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-transparent px-2.5 text-[11.5px] font-medium text-df-muted hover:bg-df-raised hover:text-df-text",
              filter === "all" && "border-df-lime/25 bg-df-lime-dark text-df-lime",
            )}
          >
            Wszystko
            <span className={cn("text-[10px] font-semibold tabular-nums", filter === "all" ? "text-df-lime/85" : "text-df-muted/70")}>
              {results.length}
            </span>
          </button>
          {groupedCounts.map((group) => (
            <button
              key={group.type}
              type="button"
              aria-label={`${labels[group.type]} (${group.items.length})`}
              aria-pressed={filter === group.type}
              onClick={() => chooseFilter(group.type)}
              className={cn(
                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] border border-transparent px-2.5 text-[11.5px] font-medium text-df-muted hover:bg-df-raised hover:text-df-text",
                filter === group.type && "border-df-lime/25 bg-df-lime-dark text-df-lime",
              )}
            >
              {labels[group.type]}
              <span className={cn("text-[10px] font-semibold tabular-nums", filter === group.type ? "text-df-lime/85" : "text-df-muted/70")}>
                {group.items.length}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div
        id="global-search-results"
        aria-busy={state === "loading"}
        className="min-h-[332px] max-h-[min(60dvh,432px)] overflow-y-auto px-2 pb-2.5 pt-1 [scrollbar-width:thin] max-lg:min-h-0 max-lg:max-h-none max-lg:flex-1"
      >
        {content}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {state === "loading"
          ? "Wyszukiwanie…"
          : state === "ready"
            ? countLabel(visibleResults.length, results.length)
            : state === "error"
              ? "Nie udało się wyszukać danych."
              : ""}
      </p>

      <div className="hidden h-[38px] shrink-0 items-center justify-between gap-3 border-t border-df-line px-3.5 text-[10px] text-df-muted lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1">
            <Key>↑</Key>
            <Key>↓</Key> wybierz
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>↵</Key> otwórz
          </span>
          <span className="inline-flex items-center gap-1">
            <Key>Esc</Key> zamknij
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="size-[5px] shrink-0 rounded-full bg-df-lime" />
          {showCount ? (
            <>
              <span>{footerCount}</span>
              <span className="h-[11px] w-px shrink-0 bg-df-line" />
              <StoreGlyph />
              <span className="max-w-[180px] truncate">{studioName}</span>
            </>
          ) : (
            <span>{footerLabel}</span>
          )}
        </div>
      </div>
    </dialog>
  );
}
