import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyWebhookDelivery: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import {
  ensureOrderLifecycleWebhookSubscriptions,
  summarizeOrderLifecyclePayload,
} from "@/lib/shopify/order-lifecycle-webhooks";

describe("summarizeOrderLifecyclePayload", () => {
  it("reads order ids from nested refund payloads", () => {
    expect(
      summarizeOrderLifecyclePayload({
        id: 9,
        order_id: 55,
        order: { admin_graphql_api_id: "gid://shopify/Order/55", name: "#1002" },
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/55",
      orderName: "#1002",
      financialStatus: null,
    });
  });
});

describe("ensureOrderLifecycleWebhookSubscriptions", () => {
  beforeEach(() => {
    mocks.shopifyAdminRequest.mockReset();
  });

  it("subscribes cancel, refund, and return-request topics", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      webhookSubscriptionCreate: {
        webhookSubscription: { id: "gid://shopify/WebhookSubscription/1" },
        userErrors: [],
      },
    });

    const results = await ensureOrderLifecycleWebhookSubscriptions("https://shop.synarava.com");
    expect(results).toHaveLength(3);
    expect(results.map((row) => row.topic)).toEqual([
      "ORDERS_CANCELLED",
      "REFUNDS_CREATE",
      "RETURNS_REQUEST",
    ]);
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledTimes(3);
  });
});
