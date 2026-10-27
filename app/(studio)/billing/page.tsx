import { platformDb } from "@/lib/db/client";
import { requireStudio } from "@/src/server/studio/context";
import { CheckoutForm } from "./form";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { studioId } = await requireStudio("billing:manage");
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId }, select: { plan: true, status: true, trialEndsAt: true, stripeSubscriptionId: true } });
  const trial = studio.status === "trial" && studio.trialEndsAt && studio.trialEndsAt > new Date();
  const hasSubscription = studio.stripeSubscriptionId && studio.status !== "canceled";
  const { checkout } = await searchParams;
  return <div className="mx-auto flex max-w-xl flex-col gap-6">
    <h1 className="text-df-section">Abonament Detailflow</h1>
    <p>Plan: {studio.plan.toUpperCase()} · Status: {studio.status}</p>
    {trial && <p>Okres próbny trwa do {studio.trialEndsAt!.toLocaleDateString("pl-PL")}. Karta nie jest wymagana.</p>}
    {checkout === "success" && <p role="status">Powrót z Checkout. Potwierdzenie abonamentu pojawi się po otrzymaniu webhooku Stripe.</p>}
    {checkout === "canceled" && <p role="status">Przerwano Checkout. Możesz spróbować ponownie.</p>}
    {studio.status === "suspended" && <p>Konto jest wstrzymane. Skontaktuj się ze wsparciem.</p>}
    {hasSubscription && studio.status !== "suspended" && <p>Studio ma już abonament Stripe.</p>}
    {!trial && !hasSubscription && studio.status !== "suspended" && <CheckoutForm studioId={studioId} />}
  </div>;
}
