"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { MaskIcon } from "@/components/studio/MaskIcon";
import { Sheet } from "@/components/studio/Sheet";
import { cn } from "@/lib/utils";
import { bookingHref, bookings, bookingsOnDay, formatDuration, freeWindows, timeLabel, type Booking } from "./demo";

type CalendarBay = { id: string; name: string; sort: number };

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"] as const;
const DAY_MS = 86_400_000;

const addDays = (key: string, days: number) => new Date(new Date(`${key}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
/** 0 = poniedziałek. */
const weekdayIndex = (key: string) => (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
const format = (key: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("pl-PL", { ...options, timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));

type Row =
  | { kind: "booking"; at: number; booking: Booking }
  | { kind: "free"; at: number; start: number; end: number; bay: number }
  | { kind: "now"; at: number };

const navButton = "flex size-11 shrink-0 items-center justify-center rounded-full bg-df-panel text-df-text";

/**
 * M-02 — dzień boksów w układzie telefonu. Te same dane i reguły dnia co `DayGrid` (D-02):
 * `bookingsOnDay`, czas Europe/Warsaw z serwera, rezerwacje przez ten sam formularz.
 */
export function MobileDayView({ events = bookings, bays, today = "2026-10-24", nowMinutes = 690, reservationForm }: {
  events?: Booking[]; bays?: CalendarBay[]; today?: string; nowMinutes?: number; reservationForm?: ReactNode;
}) {
  const live = bays !== undefined;
  const columns = bays?.map((bay) => ({ number: bay.sort, name: bay.name })) ?? [1, 2].map((number) => ({ number, name: `Boks 0${number}` }));
  const [selected, setSelected] = useState(today);
  const [bay, setBay] = useState<number | null>(null);
  const [reserving, setReserving] = useState(false);

  const matches = (event: Booking) => bay === null || event.bay === bay;
  const dayOf = (key: string) => bookingsOnDay(events, key, { live, today }).filter(matches);
  const isToday = selected === today;
  const dayBookings = dayOf(selected);
  const weekStart = addDays(selected, -weekdayIndex(selected));
  const week = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const rows: Row[] = dayBookings.map((booking) => ({ kind: "booking", at: booking.start, booking }));
  for (const column of columns) {
    if (bay !== null && column.number !== bay) continue;
    for (const window of freeWindows(dayBookings, column.number, isToday ? nowMinutes : undefined)) {
      rows.push({ kind: "free", at: window.start, ...window, bay: column.number });
    }
  }
  if (isToday && dayBookings.length > 0 && nowMinutes >= 480 && nowMinutes <= 1080) rows.push({ kind: "now", at: nowMinutes });
  // Rezerwacje wcześniej niż wolne okno i niż linia „teraz” przy remisie.
  const order = { booking: 0, free: 1, now: 2 };
  rows.sort((a, b) => a.at - b.at || order[a.kind] - order[b.kind]);

  const bayName = (number: number) => columns.find((column) => column.number === number)?.name ?? `Boks ${number}`;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-df-body font-medium text-df-muted first-letter:uppercase">{format(selected, { month: "long", year: "numeric" })}</p>
          <h1 className="text-[26px] leading-[1.15] font-bold">Kalendarz</h1>
        </div>
        <button type="button" aria-label="Poprzedni tydzień" onClick={() => setSelected(addDays(selected, -7))} className={navButton}>
          <MaskIcon name="chevron-right" size={18} className="rotate-180" />
        </button>
        <button type="button" aria-label="Następny tydzień" onClick={() => setSelected(addDays(selected, 7))} className={navButton}>
          <MaskIcon name="chevron-right" size={18} />
        </button>
        <button type="button" disabled title="Wyszukiwanie — wkrótce" aria-label="Wyszukiwanie — wkrótce" className={cn(navButton, "cursor-not-allowed")}>
          <MaskIcon name="search" size={20} />
        </button>
      </header>

      <section aria-label="Tydzień" className="flex gap-1.5">
        {week.map((key, index) => {
          const active = key === selected;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              aria-label={format(key, { weekday: "long", day: "numeric", month: "long" })}
              onClick={() => setSelected(key)}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[14px] py-2.5",
                active ? "bg-df-lime text-df-bg" : "bg-df-panel text-df-text",
              )}
            >
              <span className={cn("text-[11px] font-medium", active ? "text-df-bg" : "text-df-muted")}>{WEEKDAYS[index]}</span>
              <span className="text-base font-bold">{Number(key.slice(8, 10))}</span>
              <span aria-hidden="true" className={cn("size-[5px] rounded-full", dayOf(key).length > 0 ? (active ? "bg-df-bg" : "bg-df-muted") : "bg-transparent")} />
            </button>
          );
        })}
      </section>

      <div role="group" aria-label="Boks" className="flex gap-1 rounded-[14px] bg-df-panel p-1">
        {[{ number: null, name: "Wszystkie" }, ...columns].map((column) => (
          <button
            key={column.number ?? "all"}
            type="button"
            aria-pressed={bay === column.number}
            onClick={() => setBay(column.number)}
            className={cn(
              "min-w-0 flex-1 truncate rounded-[10px] border py-[9px] text-df-body font-semibold",
              bay === column.number ? "border-df-muted bg-df-line text-df-text" : "border-transparent text-df-muted",
            )}
          >
            {column.name}
          </button>
        ))}
      </div>

      {!isToday && (
        <button type="button" onClick={() => setSelected(today)} className="h-11 self-start rounded-full bg-df-raised px-4 text-df-body font-semibold text-df-lime">
          Wróć do dziś
        </button>
      )}

      <section aria-label={`Plan boksów: ${format(selected, { weekday: "long", day: "numeric", month: "long" })}`} className="flex flex-col gap-2.5">
        {dayBookings.length === 0 && <p className="rounded-[18px] bg-df-panel p-4 text-center text-df-body text-df-muted">Brak rezerwacji na ten dzień.</p>}
        {rows.map((row) => {
          if (row.kind === "now") {
            return (
              <div key="now" role="separator" aria-label={`Teraz ${timeLabel(row.at)}`} className="flex items-center gap-2">
                <span className="text-df-label font-bold">{timeLabel(row.at)}</span>
                <span className="h-0.5 flex-1 bg-df-text" />
              </div>
            );
          }
          if (row.kind === "free") {
            return (
              <div key={`free-${row.bay}-${row.start}`} className="flex items-center gap-3">
                <p className="w-[46px] shrink-0 text-df-strong text-df-muted">{timeLabel(row.start)}</p>
                <button
                  type="button"
                  onClick={() => setReserving(true)}
                  className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-[14px] border border-dashed border-df-lime/50 bg-df-lime/4 px-3 py-4 text-df-body font-semibold text-df-lime"
                >
                  <MaskIcon name="plus" size={16} />
                  Wolne {formatDuration(row.end - row.start)} · {bayName(row.bay)}
                </button>
              </div>
            );
          }
          const { booking } = row;
          const running = booking.status === "in-progress";
          return (
            <div key={`${booking.id}-${booking.bay}`} className="flex items-start gap-3">
              <div className="flex w-[46px] shrink-0 flex-col gap-0.5">
                <p className="text-df-strong">{timeLabel(booking.start)}</p>
                <p className="text-df-label font-normal text-df-muted">{timeLabel(booking.end)}</p>
              </div>
              <Link
                href={bookingHref(booking)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1.5 rounded-[18px] border-l-[3px] py-3.5 pr-4 pl-3.5",
                  running ? "border-df-lime bg-df-lime-dark" : "border-df-blue bg-df-blue-dark",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-df-text">{booking.vehicle}</span>
                  <span className={cn("shrink-0 text-df-label font-semibold", running ? "text-df-lime" : "text-df-blue")}>{bayName(booking.bay)}</span>
                </span>
                <span className="truncate text-df-label font-normal text-df-muted">
                  {booking.service} · {booking.customer}
                </span>
                <span className={cn("text-[11px] leading-[1.4]", running ? "text-df-lime" : "text-df-blue")}>{running ? "● W trakcie" : "○ Zaplanowane"}</span>
              </Link>
            </div>
          );
        })}
      </section>

      <button
        type="button"
        onClick={() => setReserving(true)}
        className="flex h-12 items-center justify-center gap-2 rounded-[14px] bg-df-raised text-df-label font-semibold"
      >
        <MaskIcon name="plus" size={16} />
        Nowa rezerwacja
      </button>

      <Sheet open={reserving} onClose={() => setReserving(false)} title={live ? "Rezerwacja boksu" : "Nowa rezerwacja — wkrótce"}>
        {reservationForm ?? <p className="text-df-body text-df-muted">Kreator rezerwacji będzie dostępny w kolejnym etapie. Ten widok prezentuje demonstracyjny plan studia.</p>}
      </Sheet>
    </div>
  );
}
