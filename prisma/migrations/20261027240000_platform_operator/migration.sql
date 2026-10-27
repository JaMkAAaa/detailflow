-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('owner', 'support', 'admin');

-- AlterTable
ALTER TABLE "Studio" ADD COLUMN "activatedAt" TIMESTAMP(3);

UPDATE "Studio" SET "activatedAt" = "createdAt" WHERE status = 'active';

-- CreateTable
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOperator_userId_key" ON "PlatformOperator"("userId");

-- AddForeignKey
ALTER TABLE "PlatformOperator" ADD CONSTRAINT "PlatformOperator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
