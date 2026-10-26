/* eslint-disable @next/next/no-img-element -- Local Figma assets; retain SVG root dimensions. */
const metrics = [
  {
    label: "Przychód w październiku",
    value: "28 450 zł",
    detail: "↗ 18,6% vs wrzesień",
    color: "text-df-lime",
    spark: "revenue",
  },
  {
    label: "Aktywne zlecenia",
    value: "7",
    detail: "3 w trakcie · 2 do odbioru · 2 przyjęte",
    color: "text-df-muted",
    bar: "orders",
  },
  {
    label: "Obłożenie boksów",
    value: "82%",
    detail: "13 h z 16 h dostępnych",
    color: "text-df-blue",
    bar: "occupancy",
  },
  {
    label: "Powracający klienci",
    value: "64%",
    detail: "↗ 8 p.p. w tym miesiącu",
    color: "text-df-lime",
    spark: "returning",
  },
];

export function Kpis() {
  return (
    <section
      aria-label="Wskaźniki studia — dane demonstracyjne"
      className="grid grid-cols-4 gap-4"
    >
      {metrics.map((metric) => (
        <article
          key={metric.label}
          className="relative h-[132px] min-w-0 rounded-xl bg-df-panel p-4"
        >
          <h2 className="text-df-label text-df-muted">{metric.label}</h2>
          <p className="mt-0.5 text-df-number">{metric.value}</p>
          <p
            className={`mt-0.5 whitespace-nowrap text-[clamp(10px,0.84vw,12px)] font-medium ${metric.color}`}
          >
            {metric.detail}
          </p>
          {metric.spark ? (
            <div
              aria-hidden="true"
              className="absolute top-[106px] right-4 left-4 h-[30px] overflow-hidden"
            >
              <img
                src={`/pulpit/${metric.spark}-fill.svg`}
                width={247}
                height={27}
                alt=""
                className="absolute top-[3px] max-w-none"
              />
              <img
                src={`/pulpit/${metric.spark}-line.svg`}
                width={249}
                height={26}
                alt=""
                className="absolute top-[2px] -left-px max-w-none"
              />
            </div>
          ) : (
            <div
              aria-hidden="true"
              className="mt-[14px] flex h-1.5 gap-[3px] overflow-hidden rounded"
            >
              {metric.bar === "orders" ? (
                <>
                  <span className="flex-[3] rounded bg-df-lime" />
                  <span className="flex-[2] rounded bg-df-blue" />
                  <span className="flex-[2] rounded bg-df-muted" />
                </>
              ) : (
                <>
                  <span className="flex-[82] rounded bg-df-blue" />
                  <span className="flex-[18] rounded bg-df-line" />
                </>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
