-- CreateEnum
CREATE TYPE "ChemicalUnit" AS ENUM ('piece', 'ml');

-- CreateTable
CREATE TABLE "Chemical" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "ChemicalUnit" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lowThreshold" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastReason" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chemical_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chemical_studioId_name_id_idx" ON "Chemical"("studioId", "name", "id");

-- AddForeignKey
ALTER TABLE "Chemical" ADD CONSTRAINT "Chemical_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Defence in depth for all writers, including imports and future code.
ALTER TABLE "Chemical" ADD CONSTRAINT "Chemical_quantity_range" CHECK ("quantity" BETWEEN 0 AND 2000000000);
ALTER TABLE "Chemical" ADD CONSTRAINT "Chemical_threshold_range" CHECK ("lowThreshold" BETWEEN 0 AND 2000000000);
ALTER TABLE "Chemical" ADD CONSTRAINT "Chemical_version_nonnegative" CHECK ("version" >= 0);
