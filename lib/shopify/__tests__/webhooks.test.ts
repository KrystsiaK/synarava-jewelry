import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyShopifyWebhook } from "@/lib/shopify/webhooks";

describe("Shopify webhook verification", () => {
  it("accepts a valid HMAC and rejects tampering", () => {
    const body = JSON.stringify({ id: 42, title: "Link" });
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(body).digest("base64");

    expect(verifyShopifyWebhook(body, signature, secret)).toBe(true);
    expect(verifyShopifyWebhook(`${body}x`, signature, secret)).toBe(false);
    expect(verifyShopifyWebhook(body, null, secret)).toBe(false);
  });
});
