import type { StudioStatus } from "@/lib/db/generated/client";

export type BillingAccess = { status: StudioStatus; trialEndsAt: Date | null };
export function restrictedMessage(studio: BillingAccess, now = new Date()): string | null {
  switch (studio.status) {
    case "active": return null;
    case "trial":
      return studio.trialEndsAt && studio.trialEndsAt > now ? null : "Okres próbny zakończył się. Wybierz abonament, aby przywrócić możliwość zapisu.";
    case "past_due": return "Płatność za abonament jest zaległa. Uzupełnij płatność w portalu Stripe.";
    case "canceled": return "Abonament został anulowany. Wybierz abonament, aby przywrócić możliwość zapisu.";
    case "suspended": return "Konto jest wstrzymane. Skontaktuj się ze wsparciem.";
  }
}
