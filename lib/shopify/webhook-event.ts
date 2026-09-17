import { Prisma, type SyncDirection } from "@prisma/client";

import { db } from "@/lib/db";

// A crashed/hung handler leaves its ProductSyncEvent stuck at PROCESSING forever.
// Shopify retries the same webhook id on delivery failure, so we treat a PROCESSING
// row older than this lease as abandoned and safe to reclaim.
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type WebhookEventClaim = { id: string };

/**
 * Creates the ProductSyncEvent row for a webhook delivery, or — for a retried
 * delivery of the same shopifyWebhookId — atomically reclaims it for reprocessing
 * unless it already SUCCEEDED or another attempt currently holds the lease.
 * The reclaim is a single conditional UPDATE, so it stays correct under concurrent
 * duplicate deliveries without an explicit lock.
 */
export async function claimWebhookEvent(params: {
  webhookId: string | null;
  shopifyProductId: string | null;
  direction: SyncDirection;
  topic: string;
  payload: Prisma.InputJsonValue;
}): Promise<WebhookEventClaim | null> {
  try {
    return await db.productSyncEvent.create({
      data: {
        shopifyWebhookId: params.webhookId,
        shopifyProductId: params.shopifyProductId,
        direction: params.direction,
        status: "PROCESSING",
        topic: params.topic,
        payload: params.payload,
        attemptCount: 1,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") || !params.webhookId) {
      throw error;
    }
  }

  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const reclaimed = await db.productSyncEvent.updateMany({
    where: {
      shopifyWebhookId: params.webhookId,
      OR: [{ status: "FAILED" }, { status: "PROCESSING", updatedAt: { lt: staleBefore } }],
    },
    data: { status: "PROCESSING", error: null, attemptCount: { increment: 1 } },
  });
  if (reclaimed.count === 0) return null;

  return db.productSyncEvent.findUnique({ where: { shopifyWebhookId: params.webhookId } });
}
