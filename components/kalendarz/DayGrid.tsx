"use client";

import { Fragment, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { bookingHref, bookings, bookingsOnDay, freeWindows, layoutBookings, matchesEmployee, timeLabel, UNASSIGNED, type Booking } from "./demo";
import { ReservationSlotContext, type ReservationSlot } from "./slot";

type CalendarBay = { id: string; name: string; sort: number };
export function DayGrid({ events = bookings, bays, members = [], today = "2026-10-24", nowMinutes = 690, reservationForm }: {
  events?: Booking[]; bays?: CalendarBay[]; members?: { id: string; name: string }[]; today?: string; nowMinutes?: number; reservationForm?: ReactNode;
}) {
  const live = bays !== undefined;
  const columns = bays?.map((bay) => ({ id: bay.id, number: bay.sort, name: bay.name })) ?? [1, 2].map((number) => ({ id: "", number, name: `Boks 0${number}` }));
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<"day" | "week">("day");
  const [employee, setEmployee] = useState("");
  const [slot, setSlot] = useState<ReservationSlot | null>(null);
  const reservation = useRef<HTMLDialogElement>(null);
  const openReservation = (next: ReservationSlot | null) => { setSlot(next); reservation.current?.showModal(); };
  const baseDate = new Date(`${today}T00:00:00Z`);
  const date = new Date(baseDate.getTime() + offset * 86400000);
  const dayEvents = (day: Date) => bookingsOnDay(events, day.toISOString().slice(0, 10), { live, today });
  const label = (day: Date) => new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(day);
  const matches = (event: Booking) => matchesEmployee(event, employee, live);
  const filtered = events.filter(matches);
  const dayKey = date.toISOString().slice(0, 10);
  const allDay = dayEvents(date);
  const visible = allDay.filter(matches);

  return <div className="space-y-6">
    <div className="flex min-h-[70px] items-start justify-between gap-4">
      <div><h1 className="text-df-headline">Kalendarz boksów</h1><p className="mt-1 text-df-body text-df-muted">Zaplanuj pracę zespołu. Każde auto ma swoje miejsce.</p></div>
      <Button className="h-10 w-[190px] text-df-label" onClick={() => openReservation(null)}>＋ Nowa rezerwacja</Button>
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
        <select aria-label="Filtruj pracownika" value={employee} onChange={(event) => setEmployee(event.target.value)} className="h-10 w-[170px] rounded-lg bg-df-raised px-4 text-df-label"><option value="">Wszystkie osoby</option>{live ? <><option value={UNASSIGNED}>Nieprzypisane</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</> : <><option>Michał</option><option>Kamil</option></>}</select>
      </div>
    </div>
    {view === "day" ? <section aria-label={`Plan boksów: ${label(date)}`} className="h-[710px] rounded-xl bg-df-panel p-5">
      <div className="grid h-[55px] gap-4" style={{ gridTemplateColumns: `64px repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}>
        <span className="text-df-label text-df-muted">CZAS</span>
        {columns.map((bay) => <div key={bay.number}><h2 className="text-df-section">{bay.name}</h2>{!live && <p className="mt-1 text-df-label text-df-muted">{bay.number === 1 ? "Michał · korekta i zabezpieczenie" : "Kamil · mycie i wnętrza"}</p>}</div>)}
      </div>
      <div className="my-4 h-px bg-df-line" />
      <div className="relative h-[570px]">
        {Array.from({ length: 11 }, (_, index) => <Fragment key={index}><span style={{ top: index * 54 }} className="absolute left-0 text-df-label text-df-muted">{timeLabel(480 + index * 60)}</span><span style={{ top: index * 54 + 8 }} className="absolute right-0 left-20 h-px bg-df-line" /></Fragment>)}
        <div className="absolute top-2 right-0 left-20 grid h-[540px] gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}>
          {columns.map(({ id, number: bay, name }) => <div key={bay} className="relative" aria-label={`Rezerwacje ${name}`}>
            {layoutBookings(visible.filter((booking) => booking.bay === bay)).map(({ booking, lane, lanes }) => <Link key={booking.id} href={bookingHref(booking)} style={{ top: (booking.start - 480) * .9 + 2, height: (booking.end - booking.start) * .9 - 4, left: `calc(${lane / lanes * 100}% + 2px)`, width: `calc(${100 / lanes}% - 4px)` }} className={`absolute flex flex-col items-start gap-2 overflow-auto rounded-[10px] p-4 hover:ring-1 hover:ring-current ${booking.status === "in-progress" ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}>
              <h3 className="text-df-section">{booking.vehicle}</h3><p className="text-df-body">{booking.service}</p><p className="text-df-label">{timeLabel(booking.start)}–{timeLabel(booking.end)} · {booking.customer}{live && booking.employee && ` · ${booking.employee}`}</p><Badge variant={booking.status} />
            </Link>)}
            {live && freeWindows(allDay, bay, offset === 0 ? nowMinutes : undefined).map((gap) => <button key={`free-${gap.start}`} type="button" onClick={() => openReservation({ bayId: id, from: `${dayKey}T${timeLabel(gap.start)}`, to: `${dayKey}T${timeLabel(gap.end)}`, key: Date.now() })} style={{ top: (gap.start - 480) * .9 + 2, height: (gap.end - gap.start) * .9 - 4 }} className="absolute right-0 left-0 rounded-[10px] border border-dashed border-df-lime/50 bg-df-lime/4 text-df-body font-semibold text-df-lime hover:bg-df-lime/10">+ Wolne {timeLabel(gap.start)}–{timeLabel(gap.end)} · Zarezerwuj</button>)}
            {!live && bay === 2 && offset === 0 && (!employee || employee === "Kamil") && !visible.some((booking) => booking.bay === 2 && booking.start < 810 && booking.end > 720) && <button onClick={() => openReservation(null)} style={{ top: 218, height: 77 }} className="absolute right-0 left-0 rounded-[10px] border border-dashed border-df-lime/50 bg-df-lime/4 text-df-body font-semibold text-df-lime hover:bg-df-lime/10">+ Wolne 12:00–13:30 · Zarezerwuj</button>}
          </div>)}
        </div>
        {offset === 0 && nowMinutes >= 480 && nowMinutes <= 1080 && <span aria-label={`Teraz ${timeLabel(nowMinutes)}`} className="pointer-events-none absolute right-0 left-20 z-10 h-0.5 bg-df-error" style={{ top: (nowMinutes - 480) * .9 + 8 }} />}
        {visible.length === 0 && <p className="absolute top-60 right-0 left-20 rounded-lg bg-df-panel/90 p-4 text-center text-df-muted">Brak rezerwacji na ten dzień.</p>}
      </div>
    </section> : <section aria-label="Plan tygodnia" className="grid grid-cols-7 gap-3 rounded-xl bg-df-panel p-5">
      {Array.from({ length: 7 }, (_, index) => {
        const dayOffset = offset - ((date.getUTCDay() + 6) % 7) + index;
        const day = new Date(baseDate.getTime() + dayOffset * 86400000);
        const weekEvents = live ? dayEvents(day).filter(matches) : dayOffset === 0 ? filtered : [];
        return <div key={dayOffset} className="min-h-80 rounded-lg bg-df-raised p-3"><button className="text-df-label text-df-lime" onClick={() => { setOffset(dayOffset); setView("day"); }}>{label(day)}</button>{weekEvents.length ? weekEvents.map((booking) => <Link key={booking.id} href={bookingHref(booking)} className={`mt-4 block rounded-md p-2 text-df-label ${booking.status === "in-progress" ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}>{booking.vehicle}<br />{columns.find((bay) => bay.number === booking.bay)?.name}<br />{timeLabel(booking.start)}–{timeLabel(booking.end)}</Link>) : <p className="mt-4 text-df-label text-df-muted">Brak rezerwacji</p>}</div>;
      })}
    </section>}
    <p className="text-df-label text-df-muted"><span className="text-df-lime">●</span> W trakcie <span className="ml-4 text-df-blue">○</span> Zaplanowane {!live && offset === 0 && <span className="ml-4">· Boks 02 wolny 12:00–13:30</span>}</p>
    <dialog ref={reservation} aria-labelledby="reservation-title" className="m-auto w-[440px] rounded-xl bg-df-panel p-6 text-df-text backdrop:bg-black/60"><h2 id="reservation-title" className="text-df-section">{live ? "Rezerwacja boksu" : "Nowa rezerwacja — wkrótce"}</h2><ReservationSlotContext.Provider value={slot}>{reservationForm ?? <p className="mt-3 text-df-body text-df-muted">Kreator rezerwacji będzie dostępny w kolejnym etapie. Ten widok prezentuje demonstracyjny plan studia.</p>}</ReservationSlotContext.Provider><form method="dialog"><button className={buttonVariants({ variant: "secondary", className: "mt-5" })}>Zamknij</button></form></dialog>
  </div>;
}
