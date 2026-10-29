import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyWebhook(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Non-empty `x-shopify-webhook-id`, or null when missing/blank (REL-003).
 * Callers must reject with 400 before claim — null ids skip unique reclaim
 * and insert unbounded ProductSyncEvent / ShopifyWebhookDelivery rows.
 */
export function readShopifyWebhookId(header: string | null): string | null {
  const trimmed = header?.trim();
  return trimmed || null;
}
