-- CreateEnum
CREATE TYPE "PlatformCostCategory" AS ENUM ('infrastructure', 'messaging', 'support');

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "stripeInvoiceId" TEXT NOT NULL,
    "amountNet" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformCost" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "category" "PlatformCostCategory" NOT NULL,
    "amountNet" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_stripeInvoiceId_key" ON "SubscriptionPayment"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_paidAt_idx" ON "SubscriptionPayment"("paidAt");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_studioId_paidAt_idx" ON "SubscriptionPayment"("studioId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformCost_year_month_category_key" ON "PlatformCost"("year", "month", "category");

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
