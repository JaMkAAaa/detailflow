CREATE TABLE "AuthLockout" (
    "id" TEXT NOT NULL,
    "subjectHash" TEXT NOT NULL,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthLockout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthLockout_subjectHash_key" ON "AuthLockout"("subjectHash");
