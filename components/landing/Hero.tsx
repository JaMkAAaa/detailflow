import { DashboardPreview, PhonePreview } from "./DashboardPreview";
import { heroChecks } from "./content";
import { CtaLink } from "./primitives";

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-[radial-gradient(ellipse_at_50%_72%,rgba(61,77,23,0.55),rgba(10,11,13,0)_55%)] pt-14 md:pt-24"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-5 text-center md:gap-7 md:px-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-df-lime-dark px-3 py-1.5 text-[13px] font-semibold text-df-lime">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-df-lime" />
          Nowość: faktury z wysyłką do KSeF 2.0
        </span>
        <h1 id="hero-title" className="max-w-[1000px] text-[40px] leading-[1.04] font-bold tracking-[-0.03em] text-df-text md:text-[72px]">
          Twoje studio detailingu.
          <span className="block text-df-lime">Bez Excela. Bez chaosu.</span>
        </h1>
        <p className="max-w-[720px] text-[16px] leading-[1.5] text-df-muted md:text-[20px]">
          Rezerwacje boksów, zlecenia, zdjęcia przed i po, wyceny i faktury w jednym miejscu. Klient śledzi swoje auto na żywo, a Ty wreszcie wiesz, ile naprawdę zarabiasz.
        </p>
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <CtaLink />
          {/* Placeholder: wideo demo (2 min) jeszcze nie istnieje — przewijamy do podglądu pulpitu. */}
          <a
            href="#podglad"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] border border-df-line px-[26px] py-4 text-[16px] font-semibold text-df-text hover:bg-df-raised"
          >
            <span aria-hidden="true">▶</span> Zobacz demo (2 min)
          </a>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-[22px] gap-y-2 text-[14px] font-medium text-df-muted">
          {heroChecks.map((check) => (
            <li key={check}>✓ {check}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-0.5 text-df-muted">
          <p className="text-[14px] font-bold tracking-wide">WERSJA DEMONSTRACYJNA</p>
          <p className="text-[13px]">Przykładowe dane studia · bez ocen klientów</p>
        </div>
      </div>
      <div id="podglad" className="mt-10 scroll-mt-24 md:mt-14">
        <div className="hidden xl:block">
          <DashboardPreview />
        </div>
        <div className="pb-12 xl:hidden">
          <PhonePreview />
        </div>
      </div>
    </section>
  );
}
