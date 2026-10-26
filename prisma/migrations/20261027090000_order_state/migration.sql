CREATE TABLE "OrderCounter" (
    "studioId" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("studioId")
);

CREATE TABLE "WorkOrderEvent" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "fromStage" INTEGER,
    "toStage" INTEGER NOT NULL,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkOrderEvent_workOrderId_studioId_createdAt_idx" ON "WorkOrderEvent"("workOrderId", "studioId", "createdAt");

ALTER TABLE "OrderCounter" ADD CONSTRAINT "OrderCounter_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_workOrderId_studioId_fkey" FOREIGN KEY ("workOrderId", "studioId") REFERENCES "WorkOrder"("id", "studioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderEvent" ADD CONSTRAINT "WorkOrderEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Studia z istniejącymi zleceniami: licznik startuje od najwyższego numeru DF-####.
INSERT INTO "OrderCounter" ("studioId", "last")
SELECT "studioId", MAX(SUBSTRING("number" FROM 'DF-(\d+)$')::INTEGER)
FROM "WorkOrder"
WHERE "number" ~ '^DF-\d+$'
GROUP BY "studioId";
