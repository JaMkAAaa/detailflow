-- CreateTable
CREATE TABLE "QuoteSendSms" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteSendSms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSendSms_quoteId_key" ON "QuoteSendSms"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteSendSms_studioId_status_nextAttemptAt_idx" ON "QuoteSendSms"("studioId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteSendSms_quoteId_studioId_key" ON "QuoteSendSms"("quoteId", "studioId");

-- AddForeignKey
ALTER TABLE "QuoteSendSms" ADD CONSTRAINT "QuoteSendSms_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSendSms" ADD CONSTRAINT "QuoteSendSms_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

