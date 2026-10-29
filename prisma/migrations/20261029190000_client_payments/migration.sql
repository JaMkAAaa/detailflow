ALTER TABLE "Studio" ADD COLUMN "clientPaymentAccountId" TEXT;
CREATE UNIQUE INDEX "Studio_clientPaymentAccountId_key" ON "Studio"("clientPaymentAccountId");
ALTER TABLE "Invoice" ADD COLUMN "paymentPendingAt" TIMESTAMP(3), ADD COLUMN "paymentPending" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "paymentLock" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "paymentSessionId" TEXT, ADD COLUMN "paymentCustomerId" TEXT,
 ADD COLUMN "paymentAttempt" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "paymentIntentId" TEXT;
CREATE UNIQUE INDEX "Invoice_paymentSessionId_key" ON "Invoice"("paymentSessionId");
CREATE UNIQUE INDEX "Invoice_paymentIntentId_key" ON "Invoice"("paymentIntentId");
CREATE TABLE "ClientPaymentEvent" (
 "id" TEXT PRIMARY KEY, "studioId" TEXT NOT NULL, "invoiceId" TEXT NOT NULL,
 CONSTRAINT "ClientPaymentEvent_invoiceId_studioId_fkey" FOREIGN KEY ("invoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ClientPaymentEvent_studioId_invoiceId_idx" ON "ClientPaymentEvent"("studioId", "invoiceId");
