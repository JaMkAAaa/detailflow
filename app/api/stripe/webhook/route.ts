import { env } from "@/lib/env";
import { getStripe } from "@/src/server/billing/stripe";
import { processStripeEvent } from "@/src/server/billing/webhook";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return Response.json({ error: "Stripe nie jest skonfigurowany." }, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Brak podpisu." }, { status: 400 });
  const stripe = getStripe();
  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, env.STRIPE_WEBHOOK_SECRET);
  } catch { return Response.json({ error: "Nieprawidłowy podpis webhooku." }, { status: 400 }); }
  try {
    await processStripeEvent(event, stripe);
    return Response.json({ received: true });
  } catch {
    // Nie logujemy payloadu, danych klienta ani sekretów. Non-2xx uruchamia retry Stripe.
    console.error("Stripe webhook failed", { eventId: event.id, type: event.type });
    return Response.json({ error: "Ponów dostarczenie zdarzenia." }, { status: 500 });
  }
}
