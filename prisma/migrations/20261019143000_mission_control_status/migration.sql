-- CreateEnum
CREATE TYPE "ServiceStatusLevel" AS ENUM ('ok', 'warn', 'down', 'unknown');

-- CreateTable
CREATE TABLE "ServiceNodeStatus" (
    "nodeKey" TEXT NOT NULL,
    "level" "ServiceStatusLevel" NOT NULL,
    "message" TEXT,
    "counters" JSONB,
    "href" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceNodeStatus_pkey" PRIMARY KEY ("nodeKey")
);

-- CreateTable
CREATE TABLE "ServiceFlowStatus" (
    "busKey" TEXT NOT NULL,
    "lastFlowAt" TIMESTAMP(3),
    "level" "ServiceStatusLevel" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceFlowStatus_pkey" PRIMARY KEY ("busKey")
);

-- CreateIndex
CREATE INDEX "ServiceNodeStatus_level_idx" ON "ServiceNodeStatus"("level");

-- CreateIndex
CREATE INDEX "ServiceNodeStatus_checkedAt_idx" ON "ServiceNodeStatus"("checkedAt");

-- CreateIndex
CREATE INDEX "ServiceFlowStatus_level_idx" ON "ServiceFlowStatus"("level");

-- CreateIndex
CREATE INDEX "ServiceFlowStatus_lastFlowAt_idx" ON "ServiceFlowStatus"("lastFlowAt");

