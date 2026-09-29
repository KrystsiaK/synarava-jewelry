import { describe, expect, it } from "vitest";

import { parseShopifyWebhookJson } from "@/lib/shopify/webhook-json";
import { summarizeOrderLifecyclePayload } from "@/lib/shopify/order-lifecycle-webhooks";

describe("parseShopifyWebhookJson", () => {
  it("preserves refunds/create order_id digits that exceed MAX_SAFE_INTEGER", () => {
    // Official Shopify sample shape: Refund GID + numeric order_id (no nested order).
    const raw = JSON.stringify({
      id: 8902709387223,
      admin_graphql_api_id: "gid://shopify/Refund/8902709387223",
      order_id: 820982911946154508,
    });
    // JSON.stringify already loses precision on the number literal above — inject
    // the exact digit string Shopify sends on the wire.
    const wire = raw.replace(
      /"order_id":\d+/,
      '"order_id":820982911946154508',
    );

    const payload = parseShopifyWebhookJson(wire) as {
      order_id: string;
      admin_graphql_api_id: string;
    };
    expect(payload.order_id).toBe("820982911946154508");
    expect(payload.admin_graphql_api_id).toBe("gid://shopify/Refund/8902709387223");

    expect(summarizeOrderLifecyclePayload(payload)).toEqual({
      shopifyOrderId: "gid://shopify/Order/820982911946154508",
      orderName: null,
      financialStatus: null,
    });
  });
});
