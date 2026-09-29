import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { shopifyAdminRequest, ShopifyAdminError } from "@/lib/shopify/admin";

type UserError = { field?: string[]; message: string };

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export type OrderLifecycleTopic =
  | "orders/cancelled"
  | "refunds/create"
  | "returns/request";

export type OrderLifecycleSignal = {
  shopifyOrderId: string | null;
  orderName: string | null;
  financialStatus: string | null;
};

type LifecyclePayload = {
  id?: string | number;
  admin_graphql_api_id?: string;
  order_id?: string | number;
  name?: string;
  order_name?: string;
  financial_status?: string;
  order?: { admin_graphql_api_id?: string; id?: string | number; name?: string };
};

/**
 * Ops-only summary for cancellation / refund / return request webhooks.
 * Never mirrors a local Order — Shopify remains authoritative.
 *
 * Topics verified against Admin GraphQL WebhookSubscriptionTopic:
 * ORDERS_CANCELLED, REFUNDS_CREATE, RETURNS_REQUEST.
 * @see https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic
 */
export function summarizeOrderLifecyclePayload(payload: LifecyclePayload): OrderLifecycleSignal {
  const shopifyOrderId =
    (typeof payload.admin_graphql_api_id === "string" && payload.admin_graphql_api_id) ||
    (typeof payload.order?.admin_graphql_api_id === "string" && payload.order.admin_graphql_api_id) ||
    (payload.order_id != null ? String(payload.order_id) : null) ||
    (payload.order?.id != null ? String(payload.order.id) : null) ||
    (payload.id != null ? String(payload.id) : null);

  return {
    shopifyOrderId,
    orderName:
      (typeof payload.name === "string" && payload.name) ||
      (typeof payload.order_name === "string" && payload.order_name) ||
      (typeof payload.order?.name === "string" && payload.order.name) ||
      null,
    financialStatus:
      typeof payload.financial_status === "string" ? payload.financial_status : null,
  };
}

export function logOrderLifecycleSignal(params: {
  event: string;
  topic: string;
  webhookId: string | null;
  signal: OrderLifecycleSignal;
  duplicate?: boolean;
}) {
  console.info(
    JSON.stringify({
      event: params.event,
      topic: params.topic,
      shopifyWebhookId: params.webhookId,
      shopifyOrderId: params.signal.shopifyOrderId,
      orderName: params.signal.orderName,
      financialStatus: params.signal.financialStatus,
      duplicate: Boolean(params.duplicate),
    }),
  );
}

export async function claimOrderLifecycleDelivery(params: {
  webhookId: string | null;
  topic: string;
  signal: OrderLifecycleSignal;
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

export async function markOrderLifecycleDeliverySucceeded(deliveryId: string) {
  await db.shopifyWebhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "SUCCEEDED", completedAt: new Date(), error: null },
  });
}

export async function markOrderLifecycleDeliveryFailed(deliveryId: string, error: string) {
  await db.shopifyWebhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "FAILED", error, completedAt: new Date() },
  });
}

const LIFECYCLE_SUBSCRIPTIONS = [
  {
    topic: "ORDERS_CANCELLED" as const,
    path: "/api/shopify/webhooks/orders/cancelled",
    restTopic: "orders/cancelled" as const,
  },
  {
    topic: "REFUNDS_CREATE" as const,
    path: "/api/shopify/webhooks/refunds/create",
    restTopic: "refunds/create" as const,
  },
  {
    topic: "RETURNS_REQUEST" as const,
    path: "/api/shopify/webhooks/returns/request",
    restTopic: "returns/request" as const,
  },
];

/** Subscribe cancellation / refund / return-request ops signals (not a local Order store). */
export async function ensureOrderLifecycleWebhookSubscriptions(callbackBaseUrl: string) {
  const base = callbackBaseUrl.replace(/\/$/, "");
  const results: Array<{
    topic: (typeof LIFECYCLE_SUBSCRIPTIONS)[number]["topic"];
    created: boolean;
    alreadyExists: boolean;
  }> = [];

  for (const entry of LIFECYCLE_SUBSCRIPTIONS) {
    const data = await shopifyAdminRequest<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string } | null;
        userErrors: UserError[];
      };
    }>(
      `mutation SynaravaOrderLifecycleWebhook($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
          webhookSubscription { id }
          userErrors { field message }
        }
      }`,
      {
        topic: entry.topic,
        subscription: { callbackUrl: `${base}${entry.path}`, format: "JSON" },
      },
    );

    const errors = data.webhookSubscriptionCreate.userErrors;
    const alreadyExists = errors.some((error) => /already|taken|exists/i.test(error.message));
    if (errors.length && !alreadyExists) {
      throw new ShopifyAdminError(errors.map((error) => error.message).join("; "));
    }

    results.push({
      topic: entry.topic,
      created: Boolean(data.webhookSubscriptionCreate.webhookSubscription),
      alreadyExists,
    });
  }

  return results;
}
