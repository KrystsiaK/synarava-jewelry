-- CreateTable
CREATE TABLE "ShopifyWebhookDelivery" (
    "id" TEXT NOT NULL,
    "shopifyWebhookId" TEXT,
    "topic" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "orderName" TEXT,
    "financialStatus" TEXT,
    "status" "SyncEventStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ShopifyWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyWebhookDelivery_shopifyWebhookId_key" ON "ShopifyWebhookDelivery"("shopifyWebhookId");

-- CreateIndex
CREATE INDEX "ShopifyWebhookDelivery_topic_createdAt_idx" ON "ShopifyWebhookDelivery"("topic", "createdAt");

-- CreateIndex
CREATE INDEX "ShopifyWebhookDelivery_shopifyOrderId_idx" ON "ShopifyWebhookDelivery"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "ShopifyWebhookDelivery_status_createdAt_idx" ON "ShopifyWebhookDelivery"("status", "createdAt");
