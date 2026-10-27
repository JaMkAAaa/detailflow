-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "interior" TEXT NOT NULL DEFAULT 'Umiarkowane',
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "size" "VehicleSize" NOT NULL DEFAULT 'medium',
ADD COLUMN     "slotId" TEXT,
ADD COLUMN     "wizardStep" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "serviceId" TEXT;

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_studioId_code_key" ON "Service"("studioId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Service_id_studioId_key" ON "Service"("id", "studioId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
