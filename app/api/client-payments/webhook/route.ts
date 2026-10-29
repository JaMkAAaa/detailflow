import { env } from "@/lib/env";
import { paymentStripe } from "@/src/server/client-payments/stripe";
import { processClientPaymentEvent } from "@/src/server/client-payments/webhook";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!env.CLIENT_PAYMENTS_STRIPE_SECRET_KEY?.startsWith("sk_test_") || !env.CLIENT_PAYMENTS_WEBHOOK_SECRET) return Response.json({ error: "Connect sandbox nie jest skonfigurowany." }, { status: 503 });
  const stripe = paymentStripe();
  let event;
  try { event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", env.CLIENT_PAYMENTS_WEBHOOK_SECRET); }
  catch { return Response.json({ error: "Nieprawidłowy podpis." }, { status: 400 }); }
  try { await processClientPaymentEvent(event, stripe); return Response.json({ received: true }); }
  catch { return Response.json({ error: "Ponów dostarczenie zdarzenia." }, { status: 500 }); }
}
