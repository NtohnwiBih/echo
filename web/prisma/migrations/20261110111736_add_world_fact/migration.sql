-- CreateTable
CREATE TABLE "WorldFact" (
    "hash" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "owner" TEXT,
    "visibility" TEXT NOT NULL,
    "audience" TEXT[],
    "reliability" TEXT NOT NULL,
    "source" TEXT,
    "discover" BOOLEAN NOT NULL DEFAULT false,
    "embedModel" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldFact_pkey" PRIMARY KEY ("hash")
);

-- CreateIndex
CREATE INDEX "WorldFact_docId_idx" ON "WorldFact"("docId");
