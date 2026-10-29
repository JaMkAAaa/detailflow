import Link from "next/link";
import { formatPln } from "@/components/pulpit/demo";
import { formatRate } from "@/src/server/admin/metrics";
import type { PlatformSubscriptions } from "@/src/server/admin/subscriptions";
import { CostForm } from "./CostForm";

export function Subscriptions({ data, canEdit }: { data: PlatformSubscriptions; canEdit: boolean }) {
  const kpis = [
    { label: "MRR", value: formatPln(data.mrr), detail: "Suma active. Trial, past_due i suspended poza sumą." },
    { label: "Wpływy", value: formatPln(data.collected), detail: "Stripe invoice.paid, netto. Bez faktur KSeF." },
    { label: "Zaległości", value: formatPln(data.arrears.amount), detail: `${data.arrears.count} kont past_due · cena pełnego okresu` },
    {
      label: "Churn",
      value: formatRate(data.churn.rate),
      detail: `${data.churn.left} / ${data.churn.base} płacących na początku miesiąca`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-[66px] items-center justify-between gap-4">
        <div>
          <h1 className="text-df-headline">Abonamenty i przychody</h1>
          <p className="mt-1 text-df-body text-df-muted">{data.periodLabel} · netto PLN</p>
        </div>
      </header>

      <section aria-label="Wskaźniki abonamentów" className="grid grid-cols-4 gap-4">
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
          <h2 className="text-df-section">Skład MRR</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {data.composition.map((row) => (
              <li key={row.plan}>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-df-body">{row.label}</h3>
                  <p className="text-df-strong">{formatPln(row.amount)}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-df-line" aria-hidden="true">
                  <div className="h-full bg-df-lime" style={{ width: `${row.share}%` }} />
                </div>
                <p className="mt-1 text-df-label text-df-muted">
                  {row.count} kont · średnio {formatPln(row.unit)} MRR / konto
                </p>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-xl bg-df-panel p-5">
          <h2 className="text-df-section">Odejścia</h2>
          <p className="mt-3 text-df-number">{formatRate(data.churn.rate)}</p>
          <p className="mt-2 text-df-body text-df-muted">
            {data.churn.base} na starcie + {data.churn.joined} nowych − {data.churn.left} odejść.
            Teraz płaci {data.churn.paying}.
          </p>
          <p className="mt-2 text-df-label text-df-muted">
            Odejście to anulowany abonament w tym miesiącu. Trial, który się nie skonwertował, nie jest churnem.
          </p>
        </article>
      </div>

      <article className="rounded-xl bg-df-panel p-5">
        <h2 className="text-df-section">Zaległości</h2>
        <p className="mt-1 text-df-label text-df-muted">
          Stripe ponawia obciążenie karty. Tu jest kolejka kont past_due z ceną pełnego okresu — poza MRR i poza fakturami KSeF. Rzeczywiste saldo, w tym proration i kredyt, sprawdzisz w Stripe.
        </p>
        {data.arrearsRows.length === 0 ? (
          <p className="mt-3 text-df-body text-df-muted">Brak kont z zaległością.</p>
        ) : (
          <ul className="mt-3 divide-y divide-df-line">
            {data.arrearsRows.map((row) => (
              <li key={row.id}>
                <Link href={`/admin/studios/${row.publicCode}`} className="flex items-start justify-between gap-3 py-3 hover:text-df-lime">
                  <span>
                    <span className="block font-medium">{row.name}</span>
                    <span className="mt-0.5 block text-df-label text-df-muted">{row.publicCode} · {row.plan} · {row.interval === "yearly" ? "rocznie" : "miesięcznie"}</span>
                  </span>
                  <span className="text-df-strong">{formatPln(row.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="rounded-xl bg-df-panel p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-df-section">Koszty działania</h2>
          <p className="text-df-strong">
            {formatPln(data.costTotal)}
            <span className="ml-3 text-df-body text-df-muted">marża {data.marginLabel}</span>
          </p>
        </div>
        <p className="mt-1 text-df-label text-df-muted">
          Ręczny wpis v1. Marża = (MRR − koszty) / MRR, bez podatków i pozostałych kosztów.
          {data.costsEntered ? "" : " W tym miesiącu nie ma jeszcze zapisu."}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded bg-df-line" aria-hidden="true">
          <div className="h-full bg-df-lime" style={{ width: `${data.marginWidth}%` }} />
        </div>
        <CostForm monthLabel={data.monthLabel} costs={data.costs} canEdit={canEdit} />
      </article>
    </div>
  );
}
