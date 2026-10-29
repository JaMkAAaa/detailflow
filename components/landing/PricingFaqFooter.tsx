"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { plans } from "@/lib/landing/plans";
import { faq, navLinks, pricingNotes, pricingPlans } from "./content";
import { CheckIcon, Container, CtaLink, SectionHeading } from "./primitives";

export function PricingSection() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="flex flex-col gap-10">
        <SectionHeading
          id="pricing-title"
          eyebrow="Cennik"
          title="Prosty cennik. Bez prowizji od zleceń."
          lead="14 dni za darmo w każdym planie, bez karty. Ceny netto. Wybierz rozliczenie miesięczne lub roczne."
        />
        <fieldset className="flex justify-center gap-6"><legend className="sr-only">Okres rozliczeń</legend>
          <label><input type="radio" name="pricing-interval" checked={!yearly} onChange={() => setYearly(false)} /> Miesięcznie</label>
          <label><input type="radio" name="pricing-interval" checked={yearly} onChange={() => setYearly(true)} /> Rocznie</label>
        </fieldset>
        <p className="text-center text-df-label text-df-muted">{yearly ? "Pełna opłata za rok z góry. Automatyczne coroczne odnowienie." : "Rozliczenie co miesiąc."} Ceny netto PLN, podatek doliczany w Stripe.</p>
        <div className="grid gap-6 lg:grid-cols-3">
          {pricingPlans.map((card) => {
            const plan = plans.find((candidate) => candidate.id === card.id)!;
            const featured = "featured" in card && card.featured;
            return (
              <article
                key={card.id}
                className={`flex flex-col gap-6 rounded-[24px] border p-8 ${featured ? "border-df-lime bg-df-lime-dark" : "border-df-line bg-df-panel"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`text-[22px] font-bold ${featured ? "text-df-lime" : "text-df-text"}`}>{plan.name}</h3>
                  {featured && <span className="rounded-full bg-df-lime px-3 py-1 text-df-label font-semibold text-df-bg">Polecany do demo</span>}
                </div>
                <p className="min-h-[44px] text-[15px] leading-[1.5] text-df-muted">{card.description}</p>
                <p className="flex items-baseline gap-2">
                  <span className="text-[48px] leading-none font-bold text-df-text">{yearly ? plan.annualNetPln : plan.priceNetPln} zł</span>
                  <span className="text-[15px] text-df-muted">/ {yearly ? "rok" : "mies."} netto</span>
                </p>
                {/* Rejestracja zawsze startuje od trialu planu Solo, więc każdy plan prowadzi do /start. */}
                <CtaLink variant={featured ? "primary" : "outline"} className="w-full py-3 text-[15px]">
                  Zacznij 14 dni za darmo
                </CtaLink>
                <ul className="flex flex-col gap-3 border-t border-df-line pt-6">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-[15px] text-df-text">
                      <CheckIcon className="text-df-lime" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-df-body text-df-muted">
          {pricingNotes.map((note) => (
            <li key={note} className="flex items-center gap-2">
              <span aria-hidden="true" className="flex size-5 items-center justify-center rounded-full bg-df-lime-dark text-df-lime"><CheckIcon className="size-3" /></span>
              {note}
            </li>
          ))}
        </ul>
        <p className="text-center text-df-label text-df-muted">Publiczna galeria realizacji jest w aplikacji: studio samo oznacza zdjęcia. Publikacja na Instagramie nie wchodzi w ten zakres.</p>
      </Container>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-20 md:py-28">
      <Container className="flex flex-col gap-12">
        <SectionHeading id="faq-title" eyebrow="FAQ" title="Pytania, które słyszymy najczęściej." />
        <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3">
          {faq.map((item, index) => (
            <details key={item.q} open={index === 0} className="group rounded-2xl border border-df-line bg-df-panel open:border-df-lime/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-7 py-6 text-[17px] font-semibold text-df-text [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="text-[20px] text-df-muted group-open:text-df-lime"><span className="group-open:hidden">+</span><span className="hidden group-open:inline">−</span></span>
              </summary>
              <p className="px-7 pb-6 text-[15px] leading-[1.7] text-df-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="py-10 md:py-14">
      <Container>
        <div className="flex flex-col items-center gap-6 rounded-[32px] bg-gradient-to-r from-df-lime to-[#9ddb47] px-6 py-14 text-center text-df-bg md:py-20">
          <LogoMark variant="light" size={32} />
          <h2 id="cta-title" className="max-w-[720px] text-[32px] leading-[1.1] font-bold tracking-[-0.03em] md:text-[56px]">
            Zrób dziś pierwszy krok do spokojniejszego studia.
          </h2>
          <p className="text-[16px]">Załóż konto w 2 minuty. 14 dni za darmo, bez karty kredytowej.</p>
          <CtaLink variant="dark" />
        </div>
      </Container>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-df-line bg-df-side py-14">
      <Container className="flex flex-col gap-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="flex flex-col gap-4">
            <Logo size={28} />
            <p className="text-[15px] leading-[1.6] text-df-muted">
              System dla studiów detailingu.
              <br />
              Zaprojektowany w Polsce.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-16 gap-y-8">
            <nav aria-label="Produkt" className="flex flex-col gap-3">
              <p className="text-[15px] font-semibold text-df-text">Produkt</p>
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-[15px] text-df-muted hover:text-df-text">{link.label}</a>
              ))}
            </nav>
            <nav aria-label="Konto" className="flex flex-col gap-3">
              <p className="text-[15px] font-semibold text-df-text">Konto</p>
              <Link href="/start" className="text-[15px] text-df-muted hover:text-df-text">Zacznij 14 dni za darmo</Link>
              <Link href="/login" className="text-[15px] text-df-muted hover:text-df-text">Zaloguj się</Link>
            </nav>
            <nav aria-label="Dokumenty prawne" className="flex flex-col gap-3">
              <p className="text-[15px] font-semibold text-df-text">Prawne</p>
              <Link href="/regulamin" className="text-[15px] text-df-muted hover:text-df-text">Regulamin</Link>
              <Link href="/polityka-prywatnosci" className="text-[15px] text-df-muted hover:text-df-text">Polityka prywatności</Link>
              <Link href="/umowa-powierzenia" className="text-[15px] text-df-muted hover:text-df-text">Umowa powierzenia danych</Link>
            </nav>
          </div>
        </div>
        <p className="border-t border-df-line pt-6 text-df-body text-df-muted">© 2026 detailflow. Wszystkie prawa zastrzeżone.</p>
      </Container>
    </footer>
  );
}
