-- CreateTable
CREATE TABLE "InvoiceMail" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceMail_studioId_sentAt_nextAttemptAt_idx" ON "InvoiceMail"("studioId", "sentAt", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InvoiceMail_invoiceId_studioId_idx" ON "InvoiceMail"("invoiceId", "studioId");

-- AddForeignKey
ALTER TABLE "InvoiceMail" ADD CONSTRAINT "InvoiceMail_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceMail" ADD CONSTRAINT "InvoiceMail_invoiceId_studioId_fkey" FOREIGN KEY ("invoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
