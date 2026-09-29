import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";

type UserError = { field?: string[]; message: string };

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type OrdersPaidSignal = {
  shopifyOrderId: string | null;
  orderName: string | null;
  financialStatus: string | null;
  currency: string | null;
  totalPrice: string | null;
};

export type OrdersPaidWebhookPayload = {
  id?: string | number;
  admin_graphql_api_id?: string;
  name?: string;
  financial_status?: string;
  currency?: string;
  total_price?: string;
};

/** Extract ops-only fields — never mirror the full Shopify Order into a local store. */
export function summarizeOrdersPaidPayload(payload: OrdersPaidWebhookPayload): OrdersPaidSignal {
  const shopifyOrderId =
    (typeof payload.admin_graphql_api_id === "string" && payload.admin_graphql_api_id) ||
    (payload.id != null ? String(payload.id) : null);

  return {
    shopifyOrderId,
    orderName: typeof payload.name === "string" ? payload.name : null,
    financialStatus: typeof payload.financial_status === "string" ? payload.financial_status : null,
    currency: typeof payload.currency === "string" ? payload.currency : null,
    totalPrice: typeof payload.total_price === "string" ? payload.total_price : null,
  };
}

export function logOrdersPaidSignal(params: {
  webhookId: string | null;
  topic: string;
  signal: OrdersPaidSignal;
  duplicate?: boolean;
}) {
  console.info(
    JSON.stringify({
      event: "shopify.orders_paid",
      topic: params.topic,
      shopifyWebhookId: params.webhookId,
      shopifyOrderId: params.signal.shopifyOrderId,
      orderName: params.signal.orderName,
      financialStatus: params.signal.financialStatus,
      currency: params.signal.currency,
      totalPrice: params.signal.totalPrice,
      duplicate: Boolean(params.duplicate),
    }),
  );
}

/**
 * Idempotent claim for ORDERS_PAID deliveries. Stores a receipt only — not a
 * local commerce Order. Same lease/reclaim pattern as product webhooks.
 */
export async function claimOrdersPaidDelivery(params: {
  webhookId: string | null;
  topic: string;
  signal: OrdersPaidSignal;
}): Promise<{ id: string } | null> {
  try {
    return await db.shopifyWebhookDelivery.create({
      data: {
        shopifyWebhookId: params.webhookId,
        topic: params.topic,
        shopifyOrderId: params.signal.shopifyOrderId,
        orderName: params.signal.orderName,
        financialStatus: params.signal.financialStatus,
        status: "PROCESSING",
        attemptCount: 1,
      },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
      !params.webhookId
    ) {
      throw error;
    }
  }

  const staleBefore = new Date(Date.now() - PROCESSING_LEASE_MS);
  const reclaimed = await db.shopifyWebhookDelivery.updateMany({
    where: {
      shopifyWebhookId: params.webhookId,
      OR: [{ status: "FAILED" }, { status: "PROCESSING", updatedAt: { lt: staleBefore } }],
    },
    data: {
      status: "PROCESSING",
      error: null,
      shopifyOrderId: params.signal.shopifyOrderId,
      orderName: params.signal.orderName,
      financialStatus: params.signal.financialStatus,
      attemptCount: { increment: 1 },
    },
  });
  if (reclaimed.count === 0) return null;

  return db.shopifyWebhookDelivery.findUnique({
    where: { shopifyWebhookId: params.webhookId },
    select: { id: true },
  });
}

export async function markOrdersPaidDeliverySucceeded(deliveryId: string) {
  await db.shopifyWebhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "SUCCEEDED", completedAt: new Date(), error: null },
  });
}

export async function markOrdersPaidDeliveryFailed(deliveryId: string, error: string) {
  await db.shopifyWebhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "FAILED", error, completedAt: new Date() },
  });
}

/** Subscribe production ORDERS_PAID → confirmation/ops signal (not an Order store). */
export async function ensureOrdersPaidWebhookSubscription(callbackBaseUrl: string) {
  const callbackUrl = `${callbackBaseUrl.replace(/\/$/, "")}/api/shopify/webhooks/orders/paid`;
  const data = await shopifyAdminRequest<{
    webhookSubscriptionCreate: {
      webhookSubscription: { id: string } | null;
      userErrors: UserError[];
    };
  }>(
    `mutation SynaravaOrdersPaidWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`,
    { topic: "ORDERS_PAID", subscription: { callbackUrl, format: "JSON" } },
  );

  const errors = data.webhookSubscriptionCreate.userErrors;
  const alreadyExists = errors.some((error) => /already|taken|exists/i.test(error.message));
  if (errors.length && !alreadyExists) {
    throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
  }

  return {
    topic: "ORDERS_PAID" as const,
    created: Boolean(data.webhookSubscriptionCreate.webhookSubscription),
    alreadyExists,
  };
}
