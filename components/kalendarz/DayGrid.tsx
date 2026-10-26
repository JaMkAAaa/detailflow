"use client";

import { Fragment, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { bookings, layoutBookings, timeLabel, type Booking } from "./demo";

export function DayGrid({ events = bookings }: { events?: Booking[] }) {
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"day" | "week">("day");
  const [employee, setEmployee] = useState("");
  const reservation = useRef<HTMLDialogElement>(null);
  const date = new Date(Date.UTC(2026, 9, 24 + offset));
  const label = (day: Date) => new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day);
  const filtered = events.filter((event) => !employee || event.employee === employee);
  const visible = offset === 0 ? filtered : [];

  return <div className="space-y-6">
    <div className="flex min-h-[70px] items-start justify-between gap-4">
      <div><h1 className="text-df-headline">Kalendarz boksów</h1><p className="mt-1 text-df-body text-df-muted">Zaplanuj pracę zespołu. Każde auto ma swoje miejsce.</p></div>
      <Button className="h-10 w-[190px] text-df-label" onClick={() => reservation.current?.showModal()}>＋ Nowa rezerwacja</Button>
    </div>
    <div className="flex min-h-11 items-start gap-3">
      <div className="flex h-10 w-[140px] shrink-0 items-center justify-center rounded-lg bg-df-raised text-df-label">
        <button className="h-10 w-8 rounded hover:bg-df-hover" aria-label="Poprzedni okres" onClick={() => setOffset(offset - (view === "day" ? 1 : 7))}>‹</button>
        <button className="h-10 px-2 hover:bg-df-hover" onClick={() => setOffset(0)}>Dzisiaj</button>
        <button className="h-10 w-8 rounded hover:bg-df-hover" aria-label="Następny okres" onClick={() => setOffset(offset + (view === "day" ? 1 : 7))}>›</button>
      </div>
      <p aria-live="polite" className="text-df-section">{label(date)}</p>
      <div className="ml-auto flex gap-3" aria-label="Widok kalendarza">
        {([['day', 'Dzień'], ['week', 'Tydzień']] as const).map(([value, title]) => <button key={value} aria-pressed={view === value} onClick={() => setView(value)} className={`h-7 rounded-md border px-2.5 text-df-label ${view === value ? "border-df-muted bg-df-line" : "border-transparent bg-df-raised text-df-muted"}`}>{title}</button>)}
        <select aria-label="Filtruj pracownika" value={employee} onChange={(event) => setEmployee(event.target.value)} className="h-10 w-[170px] rounded-lg bg-df-raised px-4 text-df-label"><option value="">Wszystkie osoby</option><option>Michał</option><option>Kamil</option></select>
      </div>
    </div>
    {view === "day" ? <section aria-label={`Plan boksów: ${label(date)}`} className="h-[710px] rounded-xl bg-df-panel p-5">
      <div className="grid h-[55px] grid-cols-[64px_1fr_1fr] gap-4">
        <span className="text-df-label text-df-muted">CZAS</span>
        {[1, 2].map((bay) => <div key={bay}><h2 className="text-df-section">Boks 0{bay}</h2><p className="mt-1 text-df-label text-df-muted">{bay === 1 ? "Michał · korekta i zabezpieczenie" : "Kamil · mycie i wnętrza"}</p></div>)}
      </div>
      <div className="my-4 h-px bg-df-line" />
      <div className="relative h-[570px]">
        {Array.from({ length: 11 }, (_, index) => <Fragment key={index}><span style={{ top: index * 54 }} className="absolute left-0 text-df-label text-df-muted">{timeLabel(480 + index * 60)}</span><span style={{ top: index * 54 + 8 }} className="absolute right-0 left-20 h-px bg-df-line" /></Fragment>)}
        <div className="absolute top-2 right-0 left-20 grid h-[540px] grid-cols-2 gap-4">
          {([1, 2] as const).map((bay) => <div key={bay} className="relative" aria-label={`Rezerwacje Boks 0${bay}`}>
            {layoutBookings(visible.filter((booking) => booking.bay === bay)).map(({ booking, lane, lanes }) => <Link key={booking.id} href={`/orders/${booking.id}`} style={{ top: (booking.start - 480) * .9 + 2, height: (booking.end - booking.start) * .9 - 4, left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }} className={`absolute flex flex-col items-start gap-2 overflow-auto rounded-[10px] p-4 hover:ring-1 hover:ring-current ${booking.status === "in-progress" ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}>
              <h3 className="text-df-section">{booking.vehicle}</h3><p className="text-df-body">{booking.service}</p><p className="text-df-label">{timeLabel(booking.start)}–{timeLabel(booking.end)} · {booking.customer}</p><Badge variant={booking.status} />
            </Link>)}
            {bay === 2 && offset === 0 && (!employee || employee === "Kamil") && !visible.some((booking) => booking.bay === 2 && booking.start < 810 && booking.end > 720) && <button onClick={() => reservation.current?.showModal()} style={{ top: 218, height: 77 }} className="absolute right-0 left-0 rounded-[10px] border border-dashed border-df-lime/50 bg-df-lime/4 text-df-body font-semibold text-df-lime hover:bg-df-lime/10">+ Wolne 12:00–13:30 · Zarezerwuj</button>}
          </div>)}
        </div>
        {offset === 0 && <span aria-label="Teraz 11:30" className="pointer-events-none absolute right-0 left-20 z-10 h-0.5 bg-df-error" style={{ top: 197 }} />}
        {visible.length === 0 && <p className="absolute top-60 right-0 left-20 rounded-lg bg-df-panel/90 p-4 text-center text-df-muted">Brak rezerwacji na ten dzień.</p>}
      </div>
    </section> : <section aria-label="Plan tygodnia" className="grid grid-cols-7 gap-3 rounded-xl bg-df-panel p-5">
      {Array.from({ length: 7 }, (_, index) => {
        const dayOffset = offset - ((date.getUTCDay() + 6) % 7) + index;
        const day = new Date(Date.UTC(2026, 9, 24 + dayOffset));
        return <div key={dayOffset} className="min-h-80 rounded-lg bg-df-raised p-3"><button className="text-df-label text-df-lime" onClick={() => { setOffset(dayOffset); setView("day"); }}>{label(day)}</button>{dayOffset === 0 ? filtered.map((booking) => <Link key={booking.id} href={`/orders/${booking.id}`} className={`mt-4 block rounded-md p-2 text-df-label ${booking.status === "in-progress" ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}>{booking.vehicle}<br />Boks 0{booking.bay}<br />{timeLabel(booking.start)}–{timeLabel(booking.end)}</Link>) : <p className="mt-4 text-df-label text-df-muted">Brak rezerwacji</p>}</div>;
      })}
    </section>}
    <p className="text-df-label text-df-muted"><span className="text-df-lime">●</span> W trakcie <span className="ml-4 text-df-blue">○</span> Zaplanowane {offset === 0 && <span className="ml-4">· Boks 02 wolny 12:00–13:30</span>}</p>
    <dialog ref={reservation} aria-labelledby="reservation-title" className="m-auto w-[440px] rounded-xl bg-df-panel p-6 text-df-text backdrop:bg-black/60"><h2 id="reservation-title" className="text-df-section">Nowa rezerwacja — wkrótce</h2><p className="mt-3 text-df-body text-df-muted">Kreator rezerwacji będzie dostępny w kolejnym etapie. Ten widok prezentuje demonstracyjny plan studia.</p><form method="dialog"><button className={buttonVariants({ variant: "secondary", className: "mt-5" })}>Zamknij</button></form></dialog>
  </div>;
}
