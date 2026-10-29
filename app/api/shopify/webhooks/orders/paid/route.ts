import { NextResponse } from "next/server";

import {
  decrementStockForPaidOrderLines,
  paidOrderStockLinesFromPayload,
} from "@/lib/commerce/order-stock-decrement";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import {
  claimOrdersPaidDelivery,
  logOrdersPaidSignal,
  markOrdersPaidDeliveryFailed,
  markOrdersPaidDeliverySucceeded,
  summarizeOrdersPaidPayload,
  type OrdersPaidWebhookPayload,
} from "@/lib/shopify/orders-paid-webhook";
import { parseShopifyWebhookJson } from "@/lib/shopify/webhook-json";
import { readShopifyWebhookId, verifyShopifyWebhook } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";

/**
 * Production ORDERS_PAID: HMAC + idempotent receipt, then decrement our
 * `stockOnHand` for ordered variants (floor 0). Cancel/refund do not restock —
 * mismatch stays a normal admin divergence. Shopify remains SoT for Orders.
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

  let payload: OrdersPaidWebhookPayload;
  try {
    payload = parseShopifyWebhookJson(rawBody) as OrdersPaidWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const signal = summarizeOrdersPaidPayload(payload);
  if (!signal.shopifyOrderId) {
    return NextResponse.json({ error: "Missing Shopify order id." }, { status: 400 });
  }

  const webhookId = readShopifyWebhookId(request.headers.get("x-shopify-webhook-id"));
  if (!webhookId) {
    return NextResponse.json({ error: "Missing Shopify webhook id." }, { status: 400 });
  }
  const topic = request.headers.get("x-shopify-topic") ?? "orders/paid";
  const delivery = await claimOrdersPaidDelivery({ webhookId, topic, signal });
  if (!delivery) {
    logOrdersPaidSignal({ webhookId, topic, signal, duplicate: true });
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const lines = paidOrderStockLinesFromPayload(payload);
    await db.$transaction(async (tx) => {
      await decrementStockForPaidOrderLines(lines, tx);
      await markOrdersPaidDeliverySucceeded(delivery.id, tx);
    });
    logOrdersPaidSignal({ webhookId, topic, signal });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orders paid webhook processing failed.";
    await markOrdersPaidDeliveryFailed(delivery.id, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
