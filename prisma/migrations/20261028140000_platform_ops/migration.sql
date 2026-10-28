-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'waiting', 'resolved');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('normal', 'urgent');

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "publicCode" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "priority" "SupportPriority" NOT NULL DEFAULT 'normal',
    "slaDueAt" TIMESTAMP(3) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "assigneeId" TEXT,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "authorId" TEXT,
    "fromStudio" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSession" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "ticketId" TEXT,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "SupportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorMfa" (
    "operatorId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "enabledAt" TIMESTAMP(3),
    "lastAcceptedStep" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OperatorMfa_pkey" PRIMARY KEY ("operatorId")
);

-- CreateTable
CREATE TABLE "OperatorMfaBackup" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OperatorMfaBackup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformMfaStepUp" (
    "sessionId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMfaStepUp_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_publicCode_key" ON "SupportTicket"("publicCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_id_studioId_key" ON "SupportTicket"("id", "studioId");

-- CreateIndex
CREATE INDEX "SupportTicket_studioId_openedAt_idx" ON "SupportTicket"("studioId", "openedAt");

-- CreateIndex
CREATE INDEX "SupportTicket_status_slaDueAt_idx" ON "SupportTicket"("status", "slaDueAt");

-- CreateIndex
CREATE INDEX "SupportMessage_studioId_ticketId_createdAt_idx" ON "SupportMessage"("studioId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportSession_studioId_actorId_expiresAt_idx" ON "SupportSession"("studioId", "actorId", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportSession_expiresAt_idx" ON "SupportSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OperatorMfaBackup_operatorId_usedAt_idx" ON "OperatorMfaBackup"("operatorId", "usedAt");

-- CreateIndex
CREATE INDEX "PlatformMfaStepUp_operatorId_idx" ON "PlatformMfaStepUp"("operatorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_studioId_fkey" FOREIGN KEY ("ticketId", "studioId") REFERENCES "SupportTicket"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSession" ADD CONSTRAINT "SupportSession_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorMfa" ADD CONSTRAINT "OperatorMfa_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorMfaBackup" ADD CONSTRAINT "OperatorMfaBackup_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "OperatorMfa"("operatorId") ON DELETE CASCADE ON UPDATE CASCADE;
