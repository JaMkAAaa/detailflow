"use client";

import { useId, useState, type ReactNode } from "react";
import { formatPln } from "@/components/pulpit/demo";
import { ASSUMPTIONS, estimateSavings } from "@/lib/landing/savings";
import { Container, CtaLink, SectionHeading } from "./primitives";

type SliderProps = {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

function Slider({ label, value, display, min, max, step, onChange }: SliderProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="text-[15px] text-df-muted">{label}</label>
        <output htmlFor={id} className="rounded-lg bg-df-bg px-3 py-1 text-[14px] font-semibold text-df-text">{display}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-df-lime"
      />
    </div>
  );
}

function Row({ label, children, tone = "text-df-text" }: { label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex justify-between gap-4 text-[15px]">
      <dt className="text-df-muted">{label}</dt>
      <dd className={`font-medium ${tone}`}>{children}</dd>
    </div>
  );
}

/** ESTYMACJA na jawnych założeniach (lib/landing/savings.ts), nie wynik pomiaru klientów. */
export function SavingsCalculator() {
  const [cars, setCars] = useState(18);
  const [order, setOrder] = useState(850);
  const [hours, setHours] = useState(9);
  const [bays, setBays] = useState(2);
  const result = estimateSavings({ carsPerWeek: cars, averageOrderPln: order, paperworkHoursPerWeek: hours, bays });

  return (
    <section id="kalkulator" aria-labelledby="calc-title" className="scroll-mt-20 bg-df-side py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading
          id="calc-title"
          eyebrow="Kalkulator oszczędności"
          title="Policz, ile kosztuje Cię Excel."
          lead="Przesuń suwaki i zobacz orientacyjną estymację czasu i pieniędzy w miesiącu."
        />
        <div className="grid overflow-hidden rounded-[28px] border border-df-line md:grid-cols-[1.2fr_1fr]">
          <div className="flex flex-col gap-8 bg-df-panel p-6 md:p-12">
            <h3 className="text-[20px] font-bold text-df-text">Twoje studio</h3>
            <Slider label="Auta w tygodniu" value={cars} display={`${cars} aut`} min={1} max={60} step={1} onChange={setCars} />
            <Slider label="Średnia wartość zlecenia" value={order} display={formatPln(`${order}`)} min={100} max={3000} step={50} onChange={setOrder} />
            <Slider label="Godziny papierologii w tygodniu" value={hours} display={`${hours} h`} min={0} max={30} step={1} onChange={setHours} />
            <Slider label="Liczba boksów" value={bays} display={`${bays}`} min={1} max={8} step={1} onChange={setBays} />
          </div>
          <div className="flex flex-col gap-6 bg-df-lime-dark p-6 md:p-12" aria-live="polite">
            <p className="text-[15px] font-semibold text-df-lime">Estymacja: z detailflow możesz odzyskać</p>
            <p className="text-[56px] leading-none font-bold text-df-text md:text-[72px]">
              {result.hoursSavedPerMonth} h <span className="text-[18px] font-medium text-df-muted">miesięcznie</span>
            </p>
            <dl className="flex flex-col gap-3">
              <Row label="Mniej papierologii">−{result.hoursSavedPerMonth} h</Row>
              <Row label="Dodatkowe wizyty (założenie)">+{result.extraCars} {result.extraCars === 1 ? "auto" : "auta"}</Row>
              <Row label="Dodatkowy przychód" tone="text-df-lime">+{formatPln(result.extraRevenuePln.replace(/\.00$/, ""))}</Row>
              <Row label={`Koszt planu ${result.plan.name} (netto)`}>{result.plan.priceNetPln} zł</Row>
            </dl>
            <div className="flex items-center justify-between border-t border-df-line pt-5">
              <span className="text-[17px] font-semibold text-df-text">Zwrot z abonamentu</span>
              <span className="text-[36px] font-bold text-df-lime">{result.returnMultiple}×</span>
            </div>
            <CtaLink className="w-full" />
            <p className="text-[12px] leading-[1.5] text-df-muted">
              To estymacja, a nie pomiar wyników klientów. Zakładamy {ASSUMPTIONS.paperworkSavedShare.times(100).toString()}% mniej czasu na papierologię i{" "}
              {ASSUMPTIONS.extraVisitsShare.times(100).toString()}% dodatkowych wizyt (przy {ASSUMPTIONS.weeksPerMonth.toString().replace(".", ",")} tygodnia w miesiącu). Rzeczywiste wyniki zależą od studia.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
