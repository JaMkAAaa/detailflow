-- Portfolio (#145): publikacja jest osobną pochodną. Istniejące zdjęcia zostają prywatne.
ALTER TABLE "OrderPhoto" ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "plateVisible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "maskX" DOUBLE PRECISION,
ADD COLUMN "maskY" DOUBLE PRECISION,
ADD COLUMN "maskW" DOUBLE PRECISION,
ADD COLUMN "maskH" DOUBLE PRECISION,
ADD COLUMN "publicKey" TEXT,
ADD COLUMN "publicVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "OrderPhoto_publicKey_key" ON "OrderPhoto"("publicKey");
CREATE INDEX "OrderPhoto_studioId_publishedAt_idx" ON "OrderPhoto"("studioId", "publishedAt");

ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_public_version_nonnegative" CHECK ("publicVersion" >= 0);
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_mask_range" CHECK (
  ("maskX" IS NULL AND "maskY" IS NULL AND "maskW" IS NULL AND "maskH" IS NULL)
  OR (
    "maskX" >= 0 AND "maskX" < 1 AND "maskY" >= 0 AND "maskY" < 1
    AND "maskW" > 0 AND "maskH" > 0
    AND "maskX" + "maskW" <= 1.000001 AND "maskY" + "maskH" <= 1.000001
  )
);
ALTER TABLE "OrderPhoto" ADD CONSTRAINT "OrderPhoto_publication_shape" CHECK (
  ("publishedAt" IS NULL AND "publicKey" IS NULL)
  OR (
    "publishedAt" IS NOT NULL AND "publicKey" IS NOT NULL
    AND ("plateVisible" OR ("maskX" IS NOT NULL AND "maskY" IS NOT NULL AND "maskW" IS NOT NULL AND "maskH" IS NOT NULL))
  )
);
