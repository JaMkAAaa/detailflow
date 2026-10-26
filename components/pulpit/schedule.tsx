"use client";

import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";

const bookings = [
  {
    vehicle: "Porsche Panamera",
    service: "Korekta + ceramika",
    start: 0,
    duration: 5,
    bay: 1,
    active: true,
  },
  {
    vehicle: "BMW M4",
    service: "Detailing wnętrza",
    start: 5.07,
    duration: 2.98,
    bay: 1,
    active: false,
  },
  {
    vehicle: "Audi Q5",
    service: "Pakiet premium",
    start: 0.5,
    duration: 3.5,
    bay: 2,
    active: true,
  },
  {
    vehicle: "Mercedes C",
    service: "Mycie detailingowe",
    start: 5.57,
    duration: 2.48,
    bay: 2,
    active: false,
  },
];

export function Schedule() {
  const [dayOffset, setDayOffset] = useState(0);
  const date = new Date(Date.UTC(2026, 9, 24 + dayOffset));
  const dateLabel = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
  return (
    <section
      aria-labelledby="schedule-title"
      className="rounded-xl bg-df-panel p-5"
    >
      <div className="flex h-7 items-center justify-between gap-2">
        <h2 id="schedule-title" className="text-df-section">
          Plan studia
        </h2>
        <Link
          href="/calendar"
          className="text-df-label text-df-muted hover:text-df-text"
        >
          Otwórz kalendarz ↗
        </Link>
      </div>
      <div className="mt-3 flex h-8 items-start gap-2 text-df-label">
        <button
          onClick={() => setDayOffset(0)}
          className="h-7 rounded-md bg-df-raised px-2.5 hover:bg-df-hover"
        >
          Dzisiaj
        </button>
        <div className="flex h-7 items-center gap-1">
          <button
            aria-label="Poprzedni dzień"
            onClick={() => setDayOffset(dayOffset - 1)}
            className="size-7 rounded hover:bg-df-hover"
          >
            ‹
          </button>
          <span aria-live="polite" className="whitespace-nowrap">
            {dateLabel}
          </span>
          <button
            aria-label="Następny dzień"
            onClick={() => setDayOffset(dayOffset + 1)}
            className="size-7 rounded hover:bg-df-hover"
          >
            ›
          </button>
        </div>
        <div className="ml-auto flex gap-2 whitespace-nowrap pt-1 text-[11px] text-df-muted">
          <span>
            <span className="text-df-lime">●</span> W trakcie
          </span>
          <span>
            <span className="text-df-blue">○</span> Zaplanowane
          </span>
        </div>
      </div>
      {dayOffset === 0 ? (
        <>
          <div
            role="img"
            aria-label="Plan boksów, 24 października. Boks 01: Porsche Panamera 08:00–13:00, BMW M4 13:00–16:00. Boks 02: Audi Q5 08:30–12:00, Mercedes C 13:30–16:00. Teraz 11:30."
            className="relative mt-3 h-[178px] text-df-label text-df-muted"
          >
            <span className="absolute top-14 left-0">BOKS 01</span>
            <span className="absolute top-[116px] left-0">BOKS 02</span>
            <div className="absolute top-0 right-0 left-[88px] h-full">
              {[0, 2, 4, 6, 8, 9].map((hour) => (
                <div
                  key={hour}
                  style={{ left: `${(hour / 10) * 100}%` }}
                  className="absolute top-0 h-[154px]"
                >
                  <span className="relative -left-[13px] whitespace-nowrap">
                    {String(8 + hour).padStart(2, "0")}:00
                  </span>
                  {hour < 9 && (
                    <span className="absolute top-7 bottom-0 left-0 w-px bg-df-line" />
                  )}
                </div>
              ))}
              {bookings.map((booking) => (
                <div
                  key={booking.vehicle}
                  style={{
                    left: `${(booking.start / 10) * 100}%`,
                    width: `${(booking.duration / 10) * 100}%`,
                    top: booking.bay === 1 ? 31 : 101,
                  }}
                  className={`absolute flex h-[58px] flex-col overflow-hidden rounded-md px-2 py-1 text-[10px] leading-[14px] ${booking.active ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}
                >
                  <span className="truncate font-medium">
                    {booking.vehicle}
                  </span>
                  <span className="truncate">{booking.service}</span>
                  <span>
                    {booking.active ? "● W trakcie" : "○ Zaplanowane"}
                  </span>
                </div>
              ))}
              <span
                style={{ left: "35%" }}
                className="absolute top-7 h-[126px] w-px bg-df-lime"
              />
            </div>
          </div>
          <p className="mt-3 text-df-label text-df-muted">
            ● Teraz 11:30 <span className="px-3">·</span> Najbliższy wolny
            termin: Boks 02, 12:00
          </p>
        </>
      ) : (
        <div className="mt-3 min-h-[207px]">
          <EmptyState
            headingLevel={3}
            title="Brak rezerwacji"
            description="Na ten dzień nie ma zaplanowanych aut."
            actions={
              <button
                onClick={() => setDayOffset(0)}
                className="rounded-lg bg-df-raised px-4 py-2 hover:bg-df-hover"
              >
                Wróć do dzisiaj
              </button>
            }
          />
        </div>
      )}
    </section>
  );
}
