import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { revalidateStorefrontPath, revalidateStorefrontTemplate } from "@/lib/content/revalidate-storefront";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { refreshShopifyProductReviewAggregates } from "@/lib/shopify/product-reviews";
import { claimWebhookEvent } from "@/lib/shopify/webhook-event";
import { verifyShopifyWebhook } from "@/lib/shopify/webhooks";

export const runtime = "nodejs";

type ProductReviewWebhook = {
  id?: string;
  type?: string;
  fields?: { product?: string };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!env.SHOPIFY_WEBHOOK_SECRET || !verifyShopifyWebhook(
    rawBody,
    request.headers.get("x-shopify-hmac-sha256"),
    env.SHOPIFY_WEBHOOK_SECRET,
  )) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: ProductReviewWebhook;
  try {
    payload = JSON.parse(rawBody) as ProductReviewWebhook;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  if (payload.type !== "product_review" || !payload.id) {
    return NextResponse.json({ error: "Unexpected Shopify metaobject payload." }, { status: 400 });
  }

  const webhookId = request.headers.get("x-shopify-webhook-id");
  const topic = request.headers.get("x-shopify-topic") ?? "unknown";
  const event = await claimWebhookEvent({
    webhookId,
    shopifyProductId: payload.fields?.product ?? null,
    direction: "PULL",
    topic,
    payload: payload as Prisma.InputJsonValue,
  });
  if (!event) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    let affectedProductId: string | null = null;
    if (payload.fields?.product) {
      const products = await db.product.findMany({
        where: { shopifyProductId: payload.fields.product },
        select: { id: true, slug: true, shopifyProductId: true },
      });
      const shopifyProductIds = products.flatMap((product) => (
        product.shopifyProductId ? [product.shopifyProductId] : []
      ));
      await refreshShopifyProductReviewAggregates(shopifyProductIds);
      for (const product of products) revalidateStorefrontPath(`/products/${product.slug}`);
      affectedProductId = products.length === 1 ? products[0]?.id ?? null : null;
    } else {
      // Shopify's delete payload doesn't contain review fields, so we can't target a single
      // product. refreshShopifyProductReviewAggregates() falls back to refreshing only the
      // products that still have a review instead of the whole catalog.
      await refreshShopifyProductReviewAggregates();
      revalidateStorefrontTemplate("/products/[slug]");
    }
    await db.productSyncEvent.update({
      where: { id: event.id },
      data: {
        productId: affectedProductId,
        status: "SUCCEEDED",
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review webhook processing failed.";
    await db.productSyncEvent.update({
      where: { id: event.id },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
