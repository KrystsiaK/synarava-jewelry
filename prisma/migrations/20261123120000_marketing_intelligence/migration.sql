-- CreateTable
CREATE TABLE "CompetitorObservation" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "httpStatus" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT,
    "availability" TEXT,
    "contentHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "previousId" TEXT,

    CONSTRAINT "CompetitorObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentIdea" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "productIds" TEXT[],
    "signalIds" TEXT[],
    "hook" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "shotList" JSONB NOT NULL,
    "caption" TEXT NOT NULL,
    "plannedFor" TIMESTAMP(3),

    CONSTRAINT "ContentIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompetitorObservation_url_fetchedAt_idx" ON "CompetitorObservation"("url", "fetchedAt");

-- CreateIndex
CREATE INDEX "CompetitorObservation_domain_fetchedAt_idx" ON "CompetitorObservation"("domain", "fetchedAt");

-- CreateIndex
CREATE INDEX "ContentIdea_status_plannedFor_idx" ON "ContentIdea"("status", "plannedFor");
