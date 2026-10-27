CREATE TABLE "KsefSubmission" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "xml" TEXT NOT NULL,
    "xmlHash" TEXT NOT NULL,
    "sessionReference" TEXT,
    "invoiceReference" TEXT,
    "sendStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KsefSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KsefSubmission_invoiceId_key" ON "KsefSubmission"("invoiceId");
CREATE INDEX "KsefSubmission_studioId_invoiceId_idx" ON "KsefSubmission"("studioId", "invoiceId");
ALTER TABLE "KsefSubmission" ADD CONSTRAINT "KsefSubmission_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KsefSubmission" ADD CONSTRAINT "KsefSubmission_invoiceId_studioId_fkey" FOREIGN KEY ("invoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "KsefSubmission_invoiceId_studioId_key" ON "KsefSubmission"("invoiceId", "studioId");
