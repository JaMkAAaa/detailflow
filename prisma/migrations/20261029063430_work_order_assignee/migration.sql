-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "WorkOrder_studioId_assigneeId_idx" ON "WorkOrder"("studioId", "assigneeId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_studioId_assigneeId_fkey" FOREIGN KEY ("studioId", "assigneeId") REFERENCES "Membership"("studioId", "userId") ON DELETE NO ACTION ON UPDATE CASCADE;
