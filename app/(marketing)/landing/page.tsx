import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Detailflow — system dla studiów detailingu",
  description: "Twoje studio detailingu. Bez Excela. Bez chaosu. Boksy, zlecenia, wyceny i faktury KSeF. 14 dni za darmo, bez karty.",
  alternates: { canonical: "/" },
};

// Middleware pokazuje tę stronę pod `/` gościom bez sesji; zalogowani dostają pulpit studia.
export default function MarketingPage() {
  return <LandingPage />;
}
