CREATE TABLE "QuoteSendMail" (
  "id" TEXT NOT NULL,
  "studioId" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteSendMail_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuoteSendMail_quoteId_key" ON "QuoteSendMail"("quoteId");
CREATE UNIQUE INDEX "QuoteSendMail_quoteId_studioId_key" ON "QuoteSendMail"("quoteId", "studioId");
CREATE INDEX "QuoteSendMail_studioId_sentAt_idx" ON "QuoteSendMail"("studioId", "sentAt");
ALTER TABLE "QuoteSendMail" ADD CONSTRAINT "QuoteSendMail_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteSendMail" ADD CONSTRAINT "QuoteSendMail_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
