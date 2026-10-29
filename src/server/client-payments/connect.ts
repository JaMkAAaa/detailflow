import { platformDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { AccessError } from "../acl";
import { paymentStripe } from "./stripe";

/** Konto utworzone przez platformę, nigdy ID podane przez przeglądarkę. */
export async function connectStudio(studioId: string, stripe = paymentStripe()) {
  return platformDb.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${studioId}, 148))::text`;
    const studio = await tx.studio.findUniqueOrThrow({ where: { id: studioId } });
    let accountId = studio.clientPaymentAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({ type: "standard", country: "PL", metadata: { studioId } }, { idempotencyKey: `studio-connect-${studioId}` });
      if (account.type !== "standard") throw new AccessError(409, "Wymagane konto Stripe Standard.");
      accountId = account.id;
      await tx.studio.update({ where: { id: studioId }, data: { clientPaymentAccountId: accountId } });
    }
    const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", refresh_url: `${env.APP_URL}/settings?connect=refresh`, return_url: `${env.APP_URL}/settings?connect=return` });
    return { url: link.url };
  }, { timeout: 60000 });
}

export async function studioPaymentAccount(studioId: string, stripe = paymentStripe()) {
  const studio = await platformDb.studio.findUniqueOrThrow({ where: { id: studioId }, select: { clientPaymentAccountId: true } });
  if (!studio.clientPaymentAccountId) throw new AccessError(409, "Właściciel musi połączyć konto Stripe studia w Ustawieniach.");
  const account = await stripe.accounts.retrieve(studio.clientPaymentAccountId);
  if (account.type !== "standard" || account.metadata?.studioId !== studioId || !account.charges_enabled || !account.payouts_enabled || account.capabilities?.card_payments !== "active") {
    throw new AccessError(409, "Dokończ aktywację konta Stripe Standard studia w Ustawieniach.");
  }
  return account.id;
}
