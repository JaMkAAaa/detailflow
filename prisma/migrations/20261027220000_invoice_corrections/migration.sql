-- CreateEnum
CREATE TYPE "InvoiceKind" AS ENUM ('invoice', 'correction');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "correctionReason" TEXT,
ADD COLUMN     "correctsInvoiceId" TEXT,
ADD COLUMN     "kind" "InvoiceKind" NOT NULL DEFAULT 'invoice';

-- CreateTable
CREATE TABLE "InvoiceCounter" (
    "studioId" TEXT NOT NULL,
    "ksefEnv" "KsefEnv" NOT NULL,
    "kind" "InvoiceKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceCounter_pkey" PRIMARY KEY ("studioId","ksefEnv","kind","year")
);

-- CreateIndex
CREATE INDEX "Invoice_studioId_correctsInvoiceId_idx" ON "Invoice"("studioId", "correctsInvoiceId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_correctsInvoiceId_studioId_fkey" FOREIGN KEY ("correctsInvoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceCounter" ADD CONSTRAINT "InvoiceCounter_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Korekta zawsze wskazuje fakturę źródłową, zwykła faktura nigdy.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_correction_link_check" CHECK (("kind" = 'correction') = ("correctsInvoiceId" IS NOT NULL));
