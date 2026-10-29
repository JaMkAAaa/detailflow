-- Addytywna projekcja ceny/okresu; istniejące abonamenty są miesięczne.
CREATE TYPE "BillingInterval" AS ENUM ('monthly', 'yearly');
ALTER TABLE "Studio" ADD COLUMN "billingInterval" "BillingInterval" NOT NULL DEFAULT 'monthly',
  ADD COLUMN "subscriptionNet" DECIMAL(12,2);
UPDATE "Studio" SET "subscriptionNet" = CASE "plan" WHEN 'solo' THEN 79.00 WHEN 'studio' THEN 149.00 WHEN 'pro' THEN 279.00 END
WHERE "stripeSubscriptionId" IS NOT NULL;
-- Historyczna flaga nie jest bramką dla zatwierdzonego katalogu.
UPDATE "FeatureFlag" SET "description" = 'Historyczna flaga informacyjna. Oferta miesięczna/roczna #147 działa niezależnie od tej flagi; ceny tworzy billing:setup.' WHERE "key" = 'annual_billing';
