import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { pullShopifyInventory, refreshShopifyProductState } from "@/lib/shopify/product-sync";
import { shopifyGid, shopifyNumericId } from "@/lib/shopify/admin";
import { claimWebhookEvent } from "@/lib/shopify/webhook-event";
import { readShopifyWebhookId, verifyShopifyWebhook } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!env.SHOPIFY_WEBHOOK_SECRET || !verifyShopifyWebhook(
    rawBody,
    request.headers.get("x-shopify-hmac-sha256"),
    env.SHOPIFY_WEBHOOK_SECRET,
  )) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const webhookId = readShopifyWebhookId(request.headers.get("x-shopify-webhook-id"));
  if (!webhookId) {
    return NextResponse.json({ error: "Missing Shopify webhook id." }, { status: 400 });
  }
  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const payload = JSON.parse(rawBody) as { id?: string | number; inventory_item_id?: string | number };
  const isInventory = topic === "inventory_levels/update";
  if ((!isInventory && payload.id == null) || (isInventory && payload.inventory_item_id == null)) {
    return NextResponse.json({ error: "Missing Shopify resource id." }, { status: 400 });
  }
  const shopifyProductId = isInventory ? null : shopifyNumericId(payload.id!);

  const event = await claimWebhookEvent({
    webhookId,
    shopifyProductId,
    direction: "PULL",
    topic,
    payload: payload as Prisma.InputJsonValue,
  });
  if (!event) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    if (isInventory) {
      // Refresh Shopify inventory into shopifySnapshot + flag; never write stockOnHand.
      await pullShopifyInventory(shopifyGid("InventoryItem", payload.inventory_item_id!), event.id);
    } else if (topic === "products/delete") {
      // Presence SoT is SyncResult leaves — do not flag product.syncStatus CONFLICT.
      const product = await db.product.findUnique({ where: { shopifyProductId: shopifyProductId! } });
      await db.productSyncEvent.update({
        where: { id: event.id },
        data: { productId: product?.id, status: "SUCCEEDED", completedAt: new Date() },
      });
    } else {
      // products/create|update — Shopify-side snapshot refresh only (no syncStatus).
      await refreshShopifyProductState(shopifyProductId!, event.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
