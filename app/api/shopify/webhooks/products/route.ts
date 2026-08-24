import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { pullShopifyInventory, pullShopifyProduct } from "@/lib/shopify/product-sync";
import { shopifyGid, shopifyNumericId } from "@/lib/shopify/admin";
import { verifyShopifyWebhook } from "@/lib/shopify/webhooks";

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

  const webhookId = request.headers.get("x-shopify-webhook-id");
  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const payload = JSON.parse(rawBody) as { id?: string | number; inventory_item_id?: string | number };
  const isInventory = topic === "inventory_levels/update";
  if ((!isInventory && payload.id == null) || (isInventory && payload.inventory_item_id == null)) {
    return NextResponse.json({ error: "Missing Shopify resource id." }, { status: 400 });
  }
  const shopifyProductId = isInventory ? null : shopifyNumericId(payload.id!);

  let event;
  try {
    event = await db.productSyncEvent.create({
      data: {
        shopifyWebhookId: webhookId,
        shopifyProductId,
        direction: "PULL",
        status: "PROCESSING",
        topic,
        payload: payload as Prisma.InputJsonValue,
        attemptCount: 1,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw error;
  }

  try {
    if (isInventory) {
      await pullShopifyInventory(shopifyGid("InventoryItem", payload.inventory_item_id!), event.id);
    } else if (topic === "products/delete") {
      const product = await db.product.findUnique({ where: { shopifyProductId: shopifyProductId! } });
      if (product) {
        await db.product.update({
          where: { id: product.id },
          data: { status: "ARCHIVED", visibility: "PRIVATE", syncStatus: "UNLINKED", syncError: "Product was deleted in Shopify." },
        });
      }
      await db.productSyncEvent.update({
        where: { id: event.id },
        data: { productId: product?.id, status: "SUCCEEDED", completedAt: new Date() },
      });
    } else {
      await pullShopifyProduct(shopifyProductId!, event.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    await db.productSyncEvent.update({ where: { id: event.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
