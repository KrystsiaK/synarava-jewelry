-- CreateTable
CREATE TABLE "CommerceSyncStore" (
    "id" TEXT NOT NULL,
    "ourSnapshot" JSONB NOT NULL,
    "shopifySnapshot" JSONB NOT NULL,
    "conflictReport" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommerceSyncStore_pkey" PRIMARY KEY ("id")
);
