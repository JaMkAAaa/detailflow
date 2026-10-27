ALTER TABLE "PortalLink" ALTER COLUMN "workOrderId" DROP NOT NULL;
ALTER TABLE "PortalLink" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_target_check" CHECK (("workOrderId" IS NOT NULL) <> ("quoteId" IS NOT NULL));
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PortalLink_studioId_quoteId_idx" ON "PortalLink"("studioId", "quoteId");
CREATE TABLE "QuoteDecisionMail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studioId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteDecisionMail_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuoteDecisionMail_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuoteDecisionMail_quoteId_key" ON "QuoteDecisionMail"("quoteId");
CREATE UNIQUE INDEX "QuoteDecisionMail_quoteId_studioId_key" ON "QuoteDecisionMail"("quoteId", "studioId");
CREATE INDEX "QuoteDecisionMail_studioId_sentAt_idx" ON "QuoteDecisionMail"("studioId", "sentAt");
