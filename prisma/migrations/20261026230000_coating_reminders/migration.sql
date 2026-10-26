CREATE TABLE "CoatingReminder" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "CoatingReminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoatingReminder_studioId_completedAt_dueAt_idx" ON "CoatingReminder"("studioId", "completedAt", "dueAt");
ALTER TABLE "CoatingReminder" ADD CONSTRAINT "CoatingReminder_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoatingReminder" ADD CONSTRAINT "CoatingReminder_vehicleId_studioId_fkey" FOREIGN KEY ("vehicleId", "studioId") REFERENCES "Vehicle"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
