-- CreateEnum
CREATE TYPE "StudioStatus" AS ENUM ('trial', 'active', 'past_due', 'suspended', 'canceled');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('solo', 'studio', 'pro');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'manager', 'worker');

-- CreateEnum
CREATE TYPE "VehicleSize" AS ENUM ('small', 'medium', 'suv');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('accepted', 'in_progress', 'ready_for_pickup', 'completed', 'canceled');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'canceled');

-- CreateEnum
CREATE TYPE "KsefStatus" AS ENUM ('not_sent', 'queued', 'processing', 'accepted', 'rejected', 'retrying');

-- CreateEnum
CREATE TYPE "KsefEnv" AS ENUM ('test', 'production');

-- CreateEnum
CREATE TYPE "KsefEventKind" AS ENUM ('issued', 'validated', 'sent', 'timeout', 'processing', 'accepted', 'rejected', 'retry_scheduled');

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerLegalName" TEXT,
    "nip" TEXT,
    "address" TEXT,
    "postal" TEXT,
    "city" TEXT,
    "district" TEXT,
    "phone" TEXT,
    "status" "StudioStatus" NOT NULL DEFAULT 'trial',
    "plan" "Plan" NOT NULL DEFAULT 'solo',
    "trialEndsAt" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "ksefEnv" "KsefEnv" NOT NULL DEFAULT 'test',
    "ksefTokenEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Studio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "studioId" TEXT,
    "action" TEXT NOT NULL,
    "meta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "postal" TEXT,
    "city" TEXT,
    "nip" TEXT,
    "isRegular" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "size" "VehicleSize" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bay" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "Bay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "bayId" TEXT,
    "quoteId" TEXT,
    "status" "OrderStatus" NOT NULL,
    "service" TEXT NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 1,
    "scheduledFrom" TIMESTAMP(3) NOT NULL,
    "scheduledTo" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalGross" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL,
    "sizeMult" DECIMAL(4,2) NOT NULL,
    "paintMult" DECIMAL(4,2) NOT NULL,
    "totalGross" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "durationMin" INTEGER,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "ksefEnv" "KsefEnv" NOT NULL,
    "ksefStatus" "KsefStatus" NOT NULL DEFAULT 'not_sent',
    "ksefNumber" TEXT,
    "ksefAcceptedAt" TIMESTAMP(3),
    "ksefUpoXml" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerNip" TEXT,
    "buyerStreet" TEXT,
    "buyerPostal" TEXT,
    "buyerCity" TEXT,
    "issuedAt" TIMESTAMP(3),
    "saleAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "totalNet" DECIMAL(12,2) NOT NULL,
    "totalVat" DECIMAL(12,2) NOT NULL,
    "totalGross" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lp" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitNet" DECIMAL(12,2) NOT NULL,
    "vatRate" INTEGER NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "vat" DECIMAL(12,2) NOT NULL,
    "gross" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KsefEvent" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" "KsefEventKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "attempt" INTEGER,
    "ref" TEXT,
    "message" TEXT NOT NULL,

    CONSTRAINT "KsefEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalLink" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Studio_publicCode_key" ON "Studio"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeCustomerId_key" ON "Studio"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_stripeSubscriptionId_key" ON "Studio"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Studio_status_idx" ON "Studio"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuditLog_studioId_createdAt_idx" ON "AuditLog"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_studioId_userId_key" ON "Membership"("studioId", "userId");

-- CreateIndex
CREATE INDEX "Client_studioId_createdAt_idx" ON "Client"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "Client_studioId_name_idx" ON "Client"("studioId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Client_id_studioId_key" ON "Client"("id", "studioId");

-- CreateIndex
CREATE INDEX "Vehicle_studioId_createdAt_idx" ON "Vehicle"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "Vehicle_plate_idx" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_id_studioId_key" ON "Vehicle"("id", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_id_studioId_key" ON "Bay"("id", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "Bay_studioId_sort_key" ON "Bay"("studioId", "sort");

-- CreateIndex
CREATE INDEX "WorkOrder_studioId_status_idx" ON "WorkOrder"("studioId", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_studioId_createdAt_idx" ON "WorkOrder"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkOrder_studioId_scheduledFrom_idx" ON "WorkOrder"("studioId", "scheduledFrom");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_studioId_number_key" ON "WorkOrder"("studioId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_id_studioId_key" ON "WorkOrder"("id", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_quoteId_studioId_key" ON "WorkOrder"("quoteId", "studioId");

-- CreateIndex
CREATE INDEX "Quote_studioId_status_idx" ON "Quote"("studioId", "status");

-- CreateIndex
CREATE INDEX "Quote_studioId_createdAt_idx" ON "Quote"("studioId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_id_studioId_key" ON "Quote"("id", "studioId");

-- CreateIndex
CREATE INDEX "QuoteItem_studioId_quoteId_idx" ON "QuoteItem"("studioId", "quoteId");

-- CreateIndex
CREATE INDEX "Invoice_studioId_status_idx" ON "Invoice"("studioId", "status");

-- CreateIndex
CREATE INDEX "Invoice_studioId_ksefStatus_idx" ON "Invoice"("studioId", "ksefStatus");

-- CreateIndex
CREATE INDEX "Invoice_studioId_createdAt_idx" ON "Invoice"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "Invoice_ksefNumber_idx" ON "Invoice"("ksefNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_studioId_ksefEnv_number_key" ON "Invoice"("studioId", "ksefEnv", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_ksefEnv_ksefNumber_key" ON "Invoice"("ksefEnv", "ksefNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_studioId_key" ON "Invoice"("id", "studioId");

-- CreateIndex
CREATE INDEX "InvoiceItem_studioId_invoiceId_idx" ON "InvoiceItem"("studioId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_invoiceId_lp_key" ON "InvoiceItem"("invoiceId", "lp");

-- CreateIndex
CREATE INDEX "KsefEvent_studioId_invoiceId_at_idx" ON "KsefEvent"("studioId", "invoiceId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "PortalLink_tokenHash_key" ON "PortalLink"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalLink_studioId_workOrderId_idx" ON "PortalLink"("studioId", "workOrderId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_clientId_studioId_fkey" FOREIGN KEY ("clientId", "studioId") REFERENCES "Client"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bay" ADD CONSTRAINT "Bay_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_clientId_studioId_fkey" FOREIGN KEY ("clientId", "studioId") REFERENCES "Client"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_studioId_fkey" FOREIGN KEY ("vehicleId", "studioId") REFERENCES "Vehicle"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_bayId_studioId_fkey" FOREIGN KEY ("bayId", "studioId") REFERENCES "Bay"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_studioId_fkey" FOREIGN KEY ("clientId", "studioId") REFERENCES "Client"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_vehicleId_studioId_fkey" FOREIGN KEY ("vehicleId", "studioId") REFERENCES "Vehicle"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_studioId_fkey" FOREIGN KEY ("quoteId", "studioId") REFERENCES "Quote"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workOrderId_studioId_fkey" FOREIGN KEY ("workOrderId", "studioId") REFERENCES "WorkOrder"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_studioId_fkey" FOREIGN KEY ("invoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KsefEvent" ADD CONSTRAINT "KsefEvent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KsefEvent" ADD CONSTRAINT "KsefEvent_invoiceId_studioId_fkey" FOREIGN KEY ("invoiceId", "studioId") REFERENCES "Invoice"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalLink" ADD CONSTRAINT "PortalLink_workOrderId_studioId_fkey" FOREIGN KEY ("workOrderId", "studioId") REFERENCES "WorkOrder"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
