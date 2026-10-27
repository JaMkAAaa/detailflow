import Link from "next/link";
import { formatRate, type PlatformOverview } from "@/src/server/admin/metrics";

function formatPln(decimal: string) {
  const [whole = "0", fraction = "00"] = decimal.split(".");
  const sign = whole.startsWith("-") ? "−" : "";
  const abs = whole.replace("-", "");
  return `${sign}${abs.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}${fraction === "00" ? "" : `,${fraction}`} zł`;
}

function signedPln(decimal: string) {
  const negative = decimal.startsWith("-");
  const body = formatPln(negative ? decimal.slice(1) : decimal);
  return `${negative ? "−" : "+"}${body}`;
}

export function Overview({ data }: { data: PlatformOverview }) {
  const maxMrr = Math.max(...data.series.map((point) => Number(point.mrr)), 1);
  const kpis = [
    {
      label: "MRR",
      value: formatPln(data.mrr),
      detail: data.growth === null ? "Bez poprzedniego okresu" : `${signedPln(data.mrrDelta)} · ${formatRate(data.growth)}`,
    },
    {
      label: "Płacące studia",
      value: data.paying,
      detail: "Status active · bez trial / past_due / suspended",
    },
    {
      label: "Triale",
      value: data.trials,
      detail: "Bieżące, niewygasłe. Nie wchodzą do MRR.",
    },
    {
      label: "Aktywność",
      value: formatRate(data.activity.rate),
      detail: `${data.activity.active} z ${data.activity.paying} płacących · zlecenie w 7 dniach`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-[66px] items-center justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Przegląd platformy</h1>
          <p className="mt-1 text-df-body text-df-muted">
            {data.dateLabel} · {data.studioTotal} studiów
          </p>
        </div>
      </header>

      <section aria-label="Wskaźniki platformy" className="grid grid-cols-4 gap-4">
        {kpis.map((metric) => (
          <article key={metric.label} className="min-w-0 rounded-xl bg-df-panel p-4">
            <h2 className="text-df-label text-df-muted">{metric.label}</h2>
            <p className="mt-0.5 text-df-number">{metric.value}</p>
            <p className="mt-0.5 text-[clamp(10px,0.84vw,12px)] font-medium text-df-muted">{metric.detail}</p>
          </article>
        ))}
      </section>

      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)] items-start gap-6">
        <article className="rounded-xl bg-df-panel p-5">
          <h2 className="text-df-section">MRR · 6 miesięcy</h2>
          <p className="mt-1 text-df-label text-df-muted">Netto PLN, tylko active. Triale poza sumą.</p>
          <MrrChart series={data.series} max={maxMrr} />
        </article>

        <article className="rounded-xl bg-df-panel p-5">
          <h2 className="text-df-section">Lejek</h2>
          <ul className="mt-4 flex flex-col gap-4">
            <FunnelRow
              label="Aktywacja"
              value={formatRate(data.activation.rate)}
              detail={`${data.activation.activated} / ${data.activation.eligible} · ≥ 3 zlecenia w 7 dniach od rejestracji`}
              rate={data.activation.rate}
            />
            <FunnelRow
              label="Konwersja trialu"
              value={formatRate(data.conversion.rate)}
              detail={`${data.conversion.paid} / ${data.conversion.completed} zakończonych triali, nie bieżących`}
              rate={data.conversion.rate}
            />
          </ul>
        </article>
      </div>

      <article className="rounded-xl bg-df-panel p-5">
        <h2 className="text-df-section">Do reakcji</h2>
        {data.inbox.length === 0 ? (
          <p className="mt-3 text-df-body text-df-muted">Brak zaległości, odrzuceń KSeF i kończących się triali.</p>
        ) : (
          <ul className="mt-3 divide-y divide-df-line">
            {data.inbox.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className="flex items-start justify-between gap-3 py-3 hover:text-df-lime">
                  <span>
                    <span className="block font-medium">{item.title}</span>
                    <span className="mt-0.5 block text-df-label text-df-muted">{item.detail}</span>
                  </span>
                  <span className={item.tone === "error" ? "text-df-error" : "text-df-amber"}>●</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </div>
  );
}

function FunnelRow({
  label,
  value,
  detail,
  rate,
}: {
  label: string;
  value: string;
  detail: string;
  rate: number | null;
}) {
  const width = rate === null ? 0 : Math.round(rate * 100);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-df-body">{label}</h3>
        <p className="text-df-strong">{value}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded bg-df-line">
        <div className="h-full bg-df-lime" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-df-label text-df-muted">{detail}</p>
    </li>
  );
}

function MrrChart({ series, max }: { series: { label: string; mrr: string }[]; max: number }) {
  const w = 560;
  const h = 180;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const points = series.map((point, index) => {
    const x = pad.l + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
    const y = pad.t + innerH - (Number(point.mrr) / max) * innerH;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-[180px] w-full text-df-lime" role="img" aria-label="Wykres MRR">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points.join(" ")} />
      {series.map((point, index) => {
        const x = pad.l + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
        const y = pad.t + innerH - (Number(point.mrr) / max) * innerH;
        return (
          <g key={point.label}>
            <circle cx={x} cy={y} r="3" fill="currentColor" />
            <text x={x} y={h - 8} textAnchor="middle" className="fill-df-muted" fontSize="11">
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
