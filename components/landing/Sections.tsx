import Image from "next/image";
import { LogoMark } from "@/components/brand/Logo";
import {
  capabilities,
  comparison,
  ksefSteps,
  mainFeatures,
  portalPoints,
  scenarios,
  soonFeatures,
  steps,
  withDetailflow,
  withoutDetailflow,
  type CompareCell,
  type Feature,
} from "./content";
import { CheckIcon, Container, SectionHeading, SoonBadge } from "./primitives";

export function CapabilityStrip() {
  return (
    <section aria-label="Możliwości" className="border-y border-df-line/60 bg-df-side py-10">
      <Container className="flex flex-col items-center gap-8">
        <p className="text-df-body text-df-muted">Jeden panel dla całego studia · przykładowe możliwości</p>
        <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-8 text-center md:grid-cols-4">
          {capabilities.map((item) => (
            <div key={item.value} className="flex flex-col gap-1">
              <dt className="text-[28px] font-bold tracking-[-0.02em] text-df-text md:text-[36px]">{item.value}</dt>
              <dd className="text-df-body text-df-muted">{item.label}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section aria-labelledby="problem-title" className="py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="problem-title"
          eyebrow="Znasz to?"
          title="Prowadzisz studio, a nie arkusz kalkulacyjny."
          lead="Większość studiów zarządza rezerwacjami w Excelu, zdjęciami w telefonie, a klientami na Instagramie. Kosztuje to czas, nerwy i pieniądze."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-[24px] bg-df-panel p-6 md:p-9">
            <h3 className="mb-5 text-[20px] font-bold text-df-text">Bez detailflow</h3>
            <ul className="flex flex-col gap-4">
              {withoutDetailflow.map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-[1.5] text-df-muted">
                  <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-df-error-surface text-df-error">
                    ×
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[24px] border border-df-lime/40 bg-df-lime-dark p-6 md:p-9">
            <h3 className="mb-5 text-[20px] font-bold text-df-lime">Z detailflow</h3>
            <ul className="flex flex-col gap-4">
              {withDetailflow.map((item) => (
                <li key={item} className="flex gap-3 text-[16px] leading-[1.5] text-df-text">
                  <span aria-hidden="true" className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-df-lime text-df-bg">
                    <CheckIcon className="size-3.5" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FeatureIcon({ name }: { name: Feature["icon"] }) {
  const paths = {
    calendar: "M5 3v3M15 3v3M3 8h14M4.5 5h11A1.5 1.5 0 0 1 17 6.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5Z",
    camera: "M3 7.5A1.5 1.5 0 0 1 4.5 6h1.7l1-1.5h5.6l1 1.5h1.7A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5ZM10 13.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    calculator: "M5.5 2.5h9A1.5 1.5 0 0 1 16 4v12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 16V4a1.5 1.5 0 0 1 1.5-1.5ZM7 5.5h6M7.5 9h.01M10 9h.01M12.5 9h.01M7.5 12h.01M10 12h.01M12.5 12h.01",
  } as const;
  return (
    <span className="flex size-11 items-center justify-center rounded-xl bg-df-lime-dark text-df-lime">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[name]} />
      </svg>
    </span>
  );
}

export function FeaturesSection() {
  return (
    <section id="funkcje" aria-labelledby="features-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="features-title"
          eyebrow="Wszystko w jednym"
          title="Od pierwszego telefonu do ostatniego połysku."
          lead="Każdy etap pracy studia w jednym, szybkim panelu. Zaprojektowany z detailerami, nie z księgowymi."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {mainFeatures.map((feature) => (
            <article key={feature.title} className="flex flex-col gap-4 rounded-[24px] bg-df-panel p-8">
              <FeatureIcon name={feature.icon} />
              <h3 className="text-[22px] leading-[1.2] font-bold tracking-[-0.01em] text-df-text">{feature.title}</h3>
              <p className="text-[15px] leading-[1.6] text-df-muted">{feature.text}</p>
              {feature.icon === "camera" && (
                <div className="mt-2 grid grid-cols-2 gap-2" role="img" aria-label="Przykładowe zdjęcia przed i po">
                  <Image src="/orders/porsche-panamera.jpg" alt="" width={500} height={333} className="aspect-[154/150] rounded-lg object-cover grayscale brightness-75" />
                  <Image src="/orders/porsche-panamera.jpg" alt="" width={500} height={333} className="aspect-[154/150] rounded-lg object-cover" />
                </div>
              )}
              {feature.icon === "calculator" && (
                <dl className="mt-2 flex flex-col gap-2 rounded-xl bg-df-bg p-4 text-[13px] text-df-muted">
                  <div className="flex justify-between"><dt>Korekta lakieru</dt><dd className="text-df-text">2 000 zł</dd></div>
                  <div className="flex justify-between"><dt>× SUV</dt><dd className="text-df-text">1,35</dd></div>
                  <div className="flex justify-between"><dt>× stan lakieru</dt><dd className="text-df-text">1,10</dd></div>
                  <div className="flex items-center justify-between pt-1"><dt className="text-df-text">Razem</dt><dd className="text-[22px] font-semibold text-df-lime">2 970 zł</dd></div>
                </dl>
              )}
            </article>
          ))}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {soonFeatures.map((feature) => (
            <article key={feature.title} className="flex flex-col gap-3 rounded-[24px] bg-df-panel p-6">
              <SoonBadge />
              <h3 className="text-[19px] leading-[1.2] font-bold text-df-text">{feature.title}</h3>
              <p className="text-[15px] leading-[1.6] text-df-muted">{feature.text}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

/** Statyczny telefon z portalem klienta (Obsidian Studio, #DF-0248). */
function PortalPhone() {
  return (
    <div aria-hidden="true" className="w-[270px] shrink-0 rounded-[40px] border-[6px] border-df-raised bg-df-bg p-4 shadow-2xl">
      <div className="flex items-center gap-2 text-[10px] font-medium text-df-text">
        <LogoMark size={16} /> OBSIDIAN STUDIO
      </div>
      <p className="mt-5 text-[22px] font-semibold text-df-text">Cześć, Adam.</p>
      <p className="mb-3 text-[10px] text-df-muted">Twoje auto jest w dobrych rękach.</p>
      <div className="rounded-xl bg-df-panel p-3">
        <Image src="/orders/porsche-panamera.jpg" alt="" width={500} height={333} className="h-[92px] w-full rounded-md object-cover" />
        <p className="mt-2 text-[12px] font-medium text-df-text">Porsche Panamera</p>
        <p className="text-[9px] text-df-muted">WA 911PC · Zlecenie #DF-0248</p>
      </div>
      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-df-panel p-3 text-[10px]">
        <div className="flex justify-between"><span className="font-medium text-df-text">Postęp prac</span><span className="rounded bg-df-lime-dark px-1.5 text-df-lime">W trakcie</span></div>
        <p className="text-df-muted">✓ Przyjęcie i mycie</p>
        <p className="font-medium text-df-lime">● Korekta lakieru</p>
        <p className="text-df-muted">○ Ceramika i kontrola</p>
      </div>
      <div className="mt-3 rounded-xl bg-df-lime-dark p-3 text-[10px]">
        <p className="text-df-lime">PLANOWANY ODBIÓR</p>
        <p className="text-[12px] font-medium text-df-text">Jutro, 25 października</p>
      </div>
      <p className="mt-3 flex justify-between rounded-xl bg-df-panel p-3 text-[12px] font-medium text-df-text"><span>Wycena</span><span>4 800 zł</span></p>
    </div>
  );
}

export function PortalSection() {
  return (
    <section id="aplikacja" aria-labelledby="portal-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-5">
          <span className="inline-flex items-center gap-2 rounded-full bg-df-lime-dark px-3 py-1.5 text-df-label font-semibold text-df-lime">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-df-lime" />
            Link dla klienta
          </span>
          <h2 id="portal-title" className="text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-df-text md:text-[48px]">
            Koniec z telefonami „czy już gotowe?”
          </h2>
          <p className="text-[16px] leading-[1.6] text-df-muted md:text-[18px]">
            Klient dostaje link i widzi status auta na żywo: etapy prac, zdjęcia postępu, termin odbioru. Akceptuje wycenę jednym kliknięciem. Bez aplikacji i bez logowania.
          </p>
          <ul className="flex flex-col gap-4">
            {portalPoints.map((point) => (
              <li key={point} className="flex items-center gap-4 text-[17px] text-df-text">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-xl bg-df-lime-dark text-df-lime">
                  <CheckIcon />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center">
          <PortalPhone />
        </div>
      </Container>
    </section>
  );
}

export function KsefSection() {
  return (
    <section id="ksef" aria-labelledby="ksef-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div aria-hidden="true" className="order-2 rounded-[24px] border border-df-line bg-df-side p-5 lg:order-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[22px] font-semibold text-df-text">FV/41/10/2026</p>
              <p className="text-df-label text-df-muted">Adam Nowak · #DF-0248</p>
            </div>
            <span className="rounded-full bg-df-success-surface px-3 py-1 text-df-label font-semibold text-df-green">Przyjęta (test)</span>
          </div>
          <div className="mt-4 rounded-lg bg-[#f7f5ee] p-5 text-[11px] text-[#222]">
            <p className="text-[16px] font-bold">Faktura VAT</p>
            <p className="mb-4">FV/41/10/2026</p>
            <div className="flex justify-between border-b border-[#ccc] py-1.5"><span>Korekta lakieru · 2 etapy</span><span>1 951,22 zł</span></div>
            <div className="flex justify-between border-b border-[#ccc] py-1.5"><span>Powłoka ceramiczna 3 lata</span><span>1 951,22 zł</span></div>
            <p className="mt-3 text-right text-[13px] font-bold">Do zapłaty: 4 800,00 zł</p>
          </div>
          <p className="mt-3 text-df-label text-df-amber">KSeF — TRYB TESTOWY. To dokument nie jest fakturą produkcyjną.</p>
        </div>
        <div className="order-1 flex flex-col items-start gap-5 lg:order-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-df-lime-dark px-4 py-2 text-[15px] font-semibold text-df-lime">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-df-lime" />
            Gotowe na KSeF 2.0
          </span>
          <h2 id="ksef-title" className="text-[32px] leading-[1.1] font-bold tracking-[-0.03em] text-df-text md:text-[48px]">
            Faktura z zlecenia. Jeden klik. Prosto do KSeF.
          </h2>
          <p className="text-[16px] leading-[1.6] text-df-muted md:text-[18px]">
            Zakończone zlecenie zamieniasz w fakturę FA(3), a detailflow sam wysyła ją do Krajowego Systemu e-Faktur, pilnuje statusu i pobiera UPO. Gdy KSeF ma przerwę, ponawiamy wysyłkę za Ciebie.
          </p>
          <ol className="flex flex-col gap-4">
            {ksefSteps.map((step, index) => (
              <li key={step.title} className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-df-lime text-[17px] font-bold text-df-bg">{index + 1}</span>
                <span>
                  <span className="block text-[17px] font-semibold text-df-text">{step.title}</span>
                  <span className="text-df-body text-df-muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

const cellView: Record<CompareCell, { label: string; node: React.ReactNode }> = {
  yes: { label: "w standardzie", node: <span className="flex size-6 items-center justify-center rounded-full bg-df-lime text-df-bg"><CheckIcon className="size-3.5" /></span> },
  partial: { label: "częściowo lub przez integracje", node: <span className="flex size-6 items-center justify-center rounded-full bg-df-amber-dark text-df-amber">–</span> },
  no: { label: "brak", node: <span className="flex size-6 items-center justify-center rounded-full bg-df-error-surface text-df-error">×</span> },
  soon: { label: "wkrótce", node: <SoonBadge /> },
};

export function ComparisonSection() {
  return (
    <section aria-labelledby="compare-title" className="py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="compare-title"
          eyebrow="Porównanie"
          title="Excel nie wie, co to powłoka ceramiczna."
          lead="Ogólne CRM-y też nie. detailflow powstał wyłącznie dla studiów detailingu."
        />
        <div className="mx-auto w-full max-w-[1000px] overflow-x-auto rounded-[24px] border border-df-line bg-df-panel">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-df-line text-[14px] font-semibold text-df-text">
                <th scope="col" className="p-5"><span className="sr-only">Funkcja</span></th>
                <th scope="col" className="w-[200px] bg-df-lime/5 p-5 text-center text-df-lime">detailflow</th>
                <th scope="col" className="w-[200px] p-5 text-center">Excel + Instagram</th>
                <th scope="col" className="w-[200px] p-5 text-center">Ogólny CRM</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label} className="border-b border-df-line last:border-b-0">
                  <th scope="row" className="p-5 text-[15px] font-normal text-df-text">{row.label}</th>
                  {row.cells.map((cell, index) => (
                    <td key={index} className={`p-5 ${index === 0 ? "bg-df-lime/5" : ""}`}>
                      <span className="flex justify-center" role="img" aria-label={cellView[cell].label}>{cellView[cell].node}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-center text-df-body text-df-muted">Zestawienie poglądowe: ✓ w standardzie · – częściowo lub przez integracje · × brak</p>
      </Container>
    </section>
  );
}

export function StepsSection() {
  return (
    <section aria-labelledby="steps-title" className="bg-df-side py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading id="steps-title" eyebrow="Start w 15 minut" title="Przesiadka z Excela w jedno popołudnie." />
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <li key={step.n} className="flex flex-col gap-3 rounded-[24px] bg-df-panel p-8">
              <span className="text-[44px] leading-none font-bold text-df-lime">{step.n}</span>
              <h3 className="text-[20px] font-bold text-df-text">{step.title}</h3>
              <p className="text-[15px] leading-[1.6] text-df-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/** Zamiast opinii i ocen: scenariusze pracy z jawnym oznaczeniem „demo”. */
export function ScenariosSection() {
  return (
    <section aria-labelledby="scenarios-title" className="py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading id="scenarios-title" eyebrow="Scenariusze pracy" title="Zaprojektowany wokół pracy w studiu." />
        <div className="grid gap-6 md:grid-cols-3">
          {scenarios.map((scenario) => (
            <article key={scenario.who} className="flex flex-col gap-5 rounded-[24px] border border-df-line bg-df-panel p-8">
              <p className="text-[14px] font-bold tracking-wide text-df-lime">SCENARIUSZ DEMO</p>
              <p className="flex-1 text-[17px] leading-[1.5] text-df-text">{scenario.text}</p>
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-df-lime-dark text-[13px] font-bold text-df-lime">DF</span>
                <div>
                  <p className="text-[15px] font-semibold text-df-text">{scenario.who}</p>
                  <p className="text-df-body text-df-muted">{scenario.what}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
