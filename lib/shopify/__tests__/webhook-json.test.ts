import { describe, expect, it } from "vitest";

import { parseShopifyWebhookJson } from "@/lib/shopify/webhook-json";
import { summarizeOrderLifecyclePayload } from "@/lib/shopify/order-lifecycle-webhooks";

describe("parseShopifyWebhookJson", () => {
  it("preserves refunds/create order_id digits that exceed MAX_SAFE_INTEGER", () => {
    // Official Shopify sample shape: Refund GID + numeric order_id (no nested order).
    const wire = [
      "{",
      '"id":8902709387223,',
      '"admin_graphql_api_id":"gid://shopify/Refund/8902709387223",',
      '"order_id":820982911946154508',
      "}",
    ].join("");

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

  it("does not corrupt long digit runs inside JSON string values", () => {
    const wire = [
      "{",
      '"note":"reference:1234567890123456",',
      '"order_id":820982911946154508',
      "}",
    ].join("");

    const payload = parseShopifyWebhookJson(wire) as {
      note: string;
      order_id: string;
    };

    expect(payload.note).toBe("reference:1234567890123456");
    expect(payload.order_id).toBe("820982911946154508");
  });

  it("leaves safe integers as numbers", () => {
    const payload = parseShopifyWebhookJson('{"id":8902709387223}') as { id: number };
    expect(payload.id).toBe(8902709387223);
    expect(typeof payload.id).toBe("number");
  });
});
