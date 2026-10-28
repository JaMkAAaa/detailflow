import { formatRate } from "@/src/server/admin/metrics";
import type { PlatformAnalytics } from "@/src/server/admin/analytics";

export function Analytics({ data }: { data: PlatformAnalytics }) {
  const weeks = data.cohorts[0]?.cells.length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-[66px] items-center justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Analityka produktu</h1>
          <p className="mt-1 text-df-body text-df-muted">
            {data.periodLabel} · KSeF TEST nie wchodzi w te wykresy
          </p>
        </div>
      </header>

      <section aria-label="Lejek produktu" className="grid grid-cols-2 gap-4">
        <Metric
          label="Aktywacja"
          value={formatRate(data.activation.rate)}
          detail={`${data.activation.activated} / ${data.activation.eligible} · ≥ 3 zlecenia w 7 dniach od rejestracji. Konto bez pełnego okna jest poza mianownikiem.`}
          rate={data.activation.rate}
        />
        <Metric
          label="Konwersja trialu"
          value={formatRate(data.conversion.rate)}
          detail={`${data.conversion.paid} / ${data.conversion.completed} zakończonych triali, nie bieżących`}
          rate={data.conversion.rate}
        />
      </section>

      <article className="rounded-xl bg-df-panel p-5">
        <h2 className="text-df-section">Retencja kohortowa</h2>
        <p className="mt-1 text-df-label text-df-muted">
          Odsetek kont z utworzonym lub zaktualizowanym zleceniem w kolejnym tygodniu od rejestracji.
          Brak pełnego okna to „—”, nie 0%.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">Retencja kohortowa. Pauza oznacza niepełne okno obserwacji.</caption>
            <thead>
              <tr className="text-df-label text-df-muted">
                <th scope="col" className="py-2 pr-3 font-medium">Kohorta</th>
                {Array.from({ length: weeks }, (_, week) => (
                  <th key={week} scope="col" className="px-2 py-2 text-right font-medium">Tydz. {week}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((row) => (
                <tr key={row.label} className="border-t border-df-line">
                  <th scope="row" className="py-2 pr-3 text-df-body font-medium">{row.label}</th>
                  {row.cells.map((cell, week) => (
                    <td key={week} className="px-2 py-2 text-right tabular-nums" title={cell.observed === 0 ? "Brak pełnego okna obserwacji" : `${cell.active} / ${cell.observed}`}>
                      {formatRate(cell.rate)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-xl bg-df-panel p-5">
        <h2 className="text-df-section">Wykorzystanie funkcji</h2>
        <p className="mt-1 text-df-label text-df-muted">
          Udział płacących studiów w tym miesiącu. Faktury liczą wyłącznie KSeF PROD.
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {data.features.map((feature) => (
            <li key={feature.key}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-df-body">{feature.label}</h3>
                <p className="text-df-strong">{formatRate(feature.rate)}</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-df-line" aria-hidden="true">
                <div className="h-full bg-df-lime" style={{ width: `${feature.rate === null ? 0 : Math.round(feature.rate * 100)}%` }} />
              </div>
              <p className="mt-1 text-df-label text-df-muted">{feature.used} / {feature.eligible}</p>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

function Metric({ label, value, detail, rate }: { label: string; value: string; detail: string; rate: number | null }) {
  const width = rate === null ? 0 : Math.round(rate * 100);
  return (
    <article className="rounded-xl bg-df-panel p-5">
      <h2 className="text-df-label text-df-muted">{label}</h2>
      <p className="mt-0.5 text-df-number">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded bg-df-line" aria-hidden="true">
        <div className="h-full bg-df-lime" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-df-label text-df-muted">{detail}</p>
    </article>
  );
}
