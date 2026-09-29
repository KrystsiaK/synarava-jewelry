import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import {
  claimOrderLifecycleDelivery,
  logOrderLifecycleSignal,
  markOrderLifecycleDeliveryFailed,
  markOrderLifecycleDeliverySucceeded,
  summarizeOrderLifecyclePayload,
} from "@/lib/shopify/order-lifecycle-webhooks";
import { parseShopifyWebhookJson } from "@/lib/shopify/webhook-json";
import { verifyShopifyWebhook } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";

/**
 * REFUNDS_CREATE ops signal — HMAC + idempotent receipt + structured log.
 * @see https://shopify.dev/docs/api/admin-graphql/latest/enums/WebhookSubscriptionTopic
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (
    !env.SHOPIFY_WEBHOOK_SECRET ||
    !verifyShopifyWebhook(
      rawBody,
      request.headers.get("x-shopify-hmac-sha256"),
      env.SHOPIFY_WEBHOOK_SECRET,
    )
  ) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = parseShopifyWebhookJson(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const signal = summarizeOrderLifecyclePayload(payload as object);
  if (!signal.shopifyOrderId) {
    return NextResponse.json({ error: "Missing Shopify order id." }, { status: 400 });
  }

  const webhookId = request.headers.get("x-shopify-webhook-id");
  const topic = request.headers.get("x-shopify-topic") ?? "refunds/create";
  const delivery = await claimOrderLifecycleDelivery({ webhookId, topic, signal });
  if (!delivery) {
    logOrderLifecycleSignal({
      event: "shopify.refunds_create",
      topic,
      webhookId,
      signal,
      duplicate: true,
    });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    logOrderLifecycleSignal({
      event: "shopify.refunds_create",
      topic,
      webhookId,
      signal,
    });
    await markOrderLifecycleDeliverySucceeded(delivery.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refunds create webhook failed.";
    await markOrderLifecycleDeliveryFailed(delivery.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
