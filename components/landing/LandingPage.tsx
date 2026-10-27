import { Hero } from "./Hero";
import { FaqSection, FinalCta, PricingSection, SiteFooter } from "./PricingFaqFooter";
import { SavingsCalculator } from "./SavingsCalculator";
import {
  CapabilityStrip,
  ComparisonSection,
  FeaturesSection,
  KsefSection,
  PortalSection,
  ProblemSection,
  ScenariosSection,
  StepsSection,
} from "./Sections";
import { SiteNav } from "./SiteNav";

/** L-01 desktop + L-02 mobile (ten sam układ responsywny) + L-03 menu (w SiteNav). */
export function LandingPage() {
  return (
    <div className="bg-df-bg text-df-text">
      <a href="#landing-content" className="sr-only z-50 rounded bg-df-lime px-4 py-2 text-df-bg focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Przejdź do treści
      </a>
      <SiteNav />
      <main id="landing-content">
        <Hero />
        <CapabilityStrip />
        <ProblemSection />
        <FeaturesSection />
        <PortalSection />
        <KsefSection />
        <SavingsCalculator />
        <ComparisonSection />
        <StepsSection />
        <ScenariosSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
