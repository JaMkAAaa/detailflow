import type { DashboardMetrics } from "@/src/server/pulpit/metrics";
import { formatPln } from "./demo";

export function Kpis({ data }: { data: DashboardMetrics }) {
  const metrics = [
    {
      label: `Przychód · ${data.monthLabel}`,
      value: formatPln(data.revenuePln),
      detail: "Zakończone zlecenia · brutto PLN",
    },
    {
      label: "Aktywne zlecenia",
      value: data.active.total,
      detail: `${data.active.inProgress} w trakcie · ${data.active.ready} do odbioru · ${data.active.accepted} przyjęte`,
    },
    {
      label: "Obłożenie boksów",
      value: `${data.occupancy.percent}%`,
      detail: `${data.occupancy.occupiedHours.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} h z ${data.occupancy.capacityHours} h · dziś 08–16`,
    },
    {
      label: "Powracający klienci",
      value: `${data.returning.percent}%`,
      detail: `${data.returning.regular} stałych z ${data.returning.total} klientów`,
    },
  ];
  return (
    <section aria-label="Wskaźniki studia" className="grid grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <article
          key={metric.label}
          className="relative h-[132px] min-w-0 rounded-xl bg-df-panel p-4"
        >
          <h2 className="text-df-label text-df-muted">{metric.label}</h2>
          <p className="mt-0.5 text-df-number">{metric.value}</p>
          <p className="mt-0.5 text-[clamp(10px,0.84vw,12px)] font-medium text-df-muted">
            {metric.detail}
          </p>
          {index === 2 && (
            <div
              aria-hidden="true"
              className="mt-3 h-1.5 overflow-hidden rounded bg-df-line"
            >
              <div
                className="h-full bg-df-blue"
                style={{ width: `${data.occupancy.percent}%` }}
              />
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
