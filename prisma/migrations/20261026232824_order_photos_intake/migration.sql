-- CreateTable
CREATE TABLE "OrderPhoto" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "caption" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedAt" TIMESTAMP(3),

    CONSTRAINT "OrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeProtocol" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "IntakeProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeDamage" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "photoId" TEXT,
    "no" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "size" TEXT,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "IntakeDamage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderPhoto_key_key" ON "OrderPhoto"("key");

-- CreateIndex
CREATE INDEX "OrderPhoto_studioId_workOrderId_uploadedAt_idx" ON "OrderPhoto"("studioId", "workOrderId", "uploadedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPhoto_id_studioId_key" ON "OrderPhoto"("id", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPhoto_workOrderId_no_key" ON "OrderPhoto"("workOrderId", "no");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeProtocol_workOrderId_studioId_key" ON "IntakeProtocol"("workOrderId", "studioId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeProtocol_studioId_number_key" ON "IntakeProtocol"("studioId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeProtocol_id_studioId_key" ON "IntakeProtocol"("id", "studioId");

-- CreateIndex
CREATE INDEX "IntakeDamage_studioId_protocolId_idx" ON "IntakeDamage"("studioId", "protocolId");

-- CreateIndex
CREATE UNIQUE INDEX "IntakeDamage_protocolId_no_key" ON "IntakeDamage"("protocolId", "no");

-- AddForeignKey
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_workOrderId_studioId_fkey" FOREIGN KEY ("workOrderId", "studioId") REFERENCES "WorkOrder"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeProtocol" ADD CONSTRAINT "IntakeProtocol_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeProtocol" ADD CONSTRAINT "IntakeProtocol_workOrderId_studioId_fkey" FOREIGN KEY ("workOrderId", "studioId") REFERENCES "WorkOrder"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeProtocol" ADD CONSTRAINT "IntakeProtocol_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeDamage" ADD CONSTRAINT "IntakeDamage_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeDamage" ADD CONSTRAINT "IntakeDamage_protocolId_studioId_fkey" FOREIGN KEY ("protocolId", "studioId") REFERENCES "IntakeProtocol"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeDamage" ADD CONSTRAINT "IntakeDamage_photoId_studioId_fkey" FOREIGN KEY ("photoId", "studioId") REFERENCES "OrderPhoto"("id", "studioId") ON DELETE NO ACTION ON UPDATE CASCADE;
