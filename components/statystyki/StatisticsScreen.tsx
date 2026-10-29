import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPln } from "@/lib/format-pln";
import type { Statistics, StatisticsPresets } from "@/src/server/statystyki/statistics";

const NO_DATA = "Brak danych";
const pct = (value: string) => `${value.replace(".", ",")}%`;
const hours = (value: number) => `${value.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h`;
const day = (iso: string) => iso.split("-").reverse().join(".");

function Bar({ value, tone = "bg-df-blue" }: { value: number; tone?: string }) {
  return (
    <div aria-hidden="true" className="h-1.5 overflow-hidden rounded bg-df-line">
      <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <p role="status" className="rounded-lg bg-df-raised p-4 text-df-body text-df-muted">{children}</p>;
}

export function StatisticsScreen({ data, presets, error }: { data: Statistics; presets: StatisticsPresets; error?: string | null }) {
  const { revenue, services, occupancy, range } = data;
  const maxMonth = Math.max(...revenue.months.map((month) => Number(month.revenuePln ?? 0)), 0);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-df-headline">Statystyki studia</h1>
        <p className="mt-2 text-df-muted">
          Zakres {day(range.from)} – {day(range.to)} ({range.days} {range.days === 1 ? "dzień" : "dni"}), czas Europe/Warsaw. Dane tylko tego studia.
        </p>
      </header>

      <form method="get" aria-label="Zakres dat" className="flex flex-col gap-4 rounded-xl bg-df-panel p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex min-w-0 flex-col gap-2 text-df-label text-df-muted sm:w-44">
          Od
          <Input type="date" name="from" required defaultValue={range.from} />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-df-label text-df-muted sm:w-44">
          Do
          <Input type="date" name="to" required defaultValue={range.to} />
        </label>
        <Button type="submit">Pokaż</Button>
        <nav aria-label="Gotowe zakresy" className="flex flex-wrap gap-2 sm:ml-auto">
          {presets.map((preset) => (
            <Link
              key={preset.label}
              href={`/statistics?from=${preset.from}&to=${preset.to}`}
              className="inline-flex h-11 items-center rounded-lg bg-df-raised px-4 text-df-body text-df-text hover:bg-df-hover"
            >
              {preset.label}
            </Link>
          ))}
        </nav>
      </form>
      {error && <p role="alert" className="rounded-lg bg-df-error-surface p-4 text-df-error">{error} Pokazano bieżący miesiąc.</p>}

      <section aria-label="Wskaźniki" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article className="min-w-0 rounded-xl bg-df-panel p-4">
          <h2 className="text-df-label text-df-muted">Przychód</h2>
          <p className="mt-0.5 text-df-number [overflow-wrap:anywhere]">{revenue.totalPln ? formatPln(revenue.totalPln) : NO_DATA}</p>
          <p className="mt-0.5 text-df-label text-df-muted">Zakończone zlecenia · brutto PLN</p>
        </article>
        <article className="min-w-0 rounded-xl bg-df-panel p-4">
          <h2 className="text-df-label text-df-muted">Zakończone zlecenia</h2>
          <p className="mt-0.5 text-df-number">{revenue.hasData ? revenue.orders : NO_DATA}</p>
          <p className="mt-0.5 text-df-label text-df-muted">Anulowane i aktywne nie wchodzą do przychodu</p>
        </article>
        <article className="min-w-0 rounded-xl bg-df-panel p-4 sm:col-span-2 lg:col-span-1">
          <h2 className="text-df-label text-df-muted">Obłożenie boksów</h2>
          <p className="mt-0.5 text-df-number">{occupancy.percent ? pct(occupancy.percent) : NO_DATA}</p>
          <p className="mt-0.5 mb-3 text-df-label text-df-muted">
            {occupancy.hasData ? `${hours(occupancy.bookedHours)} z ${hours(occupancy.capacityHours)} · okno ${occupancy.windowLabel}` : `Okno ${occupancy.windowLabel}, każdy dzień zakresu`}
          </p>
          {occupancy.percent && <Bar value={Number(occupancy.percent)} />}
        </article>
      </section>

      <section aria-labelledby="stats-months" className="flex flex-col gap-4 rounded-xl bg-df-panel p-4 sm:p-5">
        <h2 id="stats-months" className="text-df-section">Przychód wg miesięcy</h2>
        {revenue.hasData ? (
          <ul className="flex flex-col gap-4">
            {revenue.months.map((month) => (
              <li key={month.key} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {month.label}
                    {month.partial && <span className="ml-2 text-df-label text-df-muted">część miesiąca: {day(month.from)} – {day(month.to)}</span>}
                  </span>
                  {month.revenuePln ? (
                    <span className="text-df-strong">{formatPln(month.revenuePln)} <span className="text-df-label font-normal text-df-muted">· {month.orders} zlec.</span></span>
                  ) : (
                    <span className="text-df-muted">{NO_DATA}</span>
                  )}
                </div>
                {month.revenuePln && <Bar value={maxMonth > 0 ? (Number(month.revenuePln) / maxMonth) * 100 : 0} tone="bg-df-lime" />}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Brak danych: w tym zakresie nie ma zakończonych zleceń. Puste miesiące nie są pokazywane jako 0 zł.</Empty>
        )}
      </section>

      <section aria-labelledby="stats-services" className="flex flex-col gap-4 rounded-xl bg-df-panel p-4 sm:p-5">
        <h2 id="stats-services" className="text-df-section">Udział usług</h2>
        {services.hasData ? (
          <>
            <p className="text-df-label text-df-muted">Zakończone zlecenia wg nazwy usługi na zleceniu; każde zlecenie liczone raz.</p>
            <ul className="flex flex-col gap-4">
              {services.rows.map((row) => (
                <li key={row.label} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{row.label}</span>
                    <span className="text-df-strong">
                      {pct(row.orderShare)} <span className="text-df-label font-normal text-df-muted">zleceń ({row.orders}) · {formatPln(row.revenuePln)}{row.revenueShare ? ` · ${pct(row.revenueShare)} przychodu` : ""}</span>
                    </span>
                  </div>
                  <Bar value={Number(row.orderShare)} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>Brak danych: udział usług powstaje z zakończonych zleceń.</Empty>
        )}
      </section>

      <section aria-labelledby="stats-bays" className="flex flex-col gap-4 rounded-xl bg-df-panel p-4 sm:p-5">
        <h2 id="stats-bays" className="text-df-section">Obłożenie wg boksów</h2>
        {occupancy.hasData ? (
          <>
            <p className="text-df-label text-df-muted">Rezerwacje bez anulowanych w oknie {occupancy.windowLabel}; nakładające się rezerwacje liczone raz.</p>
            <ul className="flex flex-col gap-4">
              {occupancy.bays.map((bay) => (
                <li key={bay.id} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="min-w-0 [overflow-wrap:anywhere]">{bay.name}</span>
                    <span className="text-df-strong">{pct(bay.percent)} <span className="text-df-label font-normal text-df-muted">· {hours(bay.bookedHours)} z {hours(bay.capacityHours)}</span></span>
                  </div>
                  <Bar value={Number(bay.percent)} />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Empty>Brak danych: w tym zakresie nie ma rezerwacji boksów albo studio nie ma boksów.</Empty>
        )}
      </section>
    </div>
  );
}
