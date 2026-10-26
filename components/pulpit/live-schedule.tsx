import Link from "next/link";
import type { DashboardMetrics } from "@/src/server/pulpit/metrics";

export function LiveSchedule({ data }: { data: DashboardMetrics }) {
  return (
    <section
      aria-labelledby="schedule-title"
      className="rounded-xl bg-df-panel p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="schedule-title" className="text-df-section">
          Plan studia
        </h2>
        <Link href="/calendar" className="text-df-label text-df-muted">
          Otwórz kalendarz ↗
        </Link>
      </div>
      <p className="mt-3 text-df-label text-df-muted">
        Dzisiaj · {data.dateLabel}
      </p>
      {data.plan.bays.length === 0 ? (
        <p className="mt-5 text-df-muted">Brak skonfigurowanych boksów.</p>
      ) : (
        <>
          <div className="mt-4 ml-[88px] flex justify-between text-df-label text-df-muted">
            {[8, 10, 12, 14, 16].map((hour) => (
              <span key={hour}>{hour}:00</span>
            ))}
          </div>
          {data.plan.bays.map((bay) => (
            <div
              key={bay.id}
              className="mt-3 flex h-[62px] items-center text-df-label"
            >
              <span className="w-[88px] shrink-0 text-df-muted">
                {bay.name}
              </span>
              <div className="relative h-full flex-1 border-x border-df-line">
                {data.plan.bookings
                  .filter((b) => b.bayId === bay.id && b.end > b.start)
                  .map((booking) => (
                    <div
                      key={booking.number}
                      style={{
                        left: `${(booking.start / 8) * 100}%`,
                        width: `${((booking.end - booking.start) / 8) * 100}%`,
                      }}
                      className={`absolute flex h-full flex-col overflow-hidden rounded-md p-2 text-[10px] ${booking.active ? "bg-df-lime-dark text-df-lime" : "bg-df-blue-dark text-df-blue"}`}
                    >
                      <span className="truncate font-medium">
                        {booking.vehicle}
                      </span>
                      <span className="truncate">{booking.service}</span>
                      <span>
                        {booking.active ? "W trakcie" : "Zaplanowane"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {data.plan.bookings.length === 0 && (
            <p className="mt-4 text-df-muted">Brak rezerwacji na dziś.</p>
          )}
        </>
      )}
    </section>
  );
}
