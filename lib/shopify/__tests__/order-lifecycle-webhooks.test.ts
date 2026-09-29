import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyGid: (resource: string, id: string | number) =>
    String(id).startsWith("gid://") ? String(id) : `gid://shopify/${resource}/${id}`,
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
  it("reads Order GIDs from cancelled payloads at the root", () => {
    expect(
      summarizeOrderLifecyclePayload({
        id: 820982911946154508,
        admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
        name: "#1001",
        financial_status: "voided",
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/820982911946154508",
      orderName: "#1001",
      financialStatus: "voided",
    });
  });

  it("normalizes refunds/create order_id to an Order GID (official sample shape)", () => {
    // Official Shopify refunds/create sample: Refund GID + numeric order_id,
    // no nested `order` object. order_id arrives as a string after
    // parseShopifyWebhookJson (64-bit ids exceed Number.MAX_SAFE_INTEGER).
    expect(
      summarizeOrderLifecyclePayload({
        id: 8902709387223,
        admin_graphql_api_id: "gid://shopify/Refund/8902709387223",
        order_id: "820982911946154508",
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/820982911946154508",
      orderName: null,
      financialStatus: null,
    });
  });

  it("prefers nested Order GID over Return admin_graphql_api_id", () => {
    expect(
      summarizeOrderLifecyclePayload({
        id: 1234567890,
        admin_graphql_api_id: "gid://shopify/Return/1234567890",
        order: {
          id: 820982911946154508,
          admin_graphql_api_id: "gid://shopify/Order/820982911946154508",
          name: "#1003",
        },
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/820982911946154508",
      orderName: "#1003",
      financialStatus: null,
    });
  });

  it("normalizes numeric order.id fallback to an Order GID", () => {
    expect(
      summarizeOrderLifecyclePayload({
        id: 9,
        admin_graphql_api_id: "gid://shopify/Refund/9",
        order: { id: 55, name: "#1002" },
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/55",
      orderName: "#1002",
      financialStatus: null,
    });
  });

  it("does not treat Return/Refund numeric ids as the order", () => {
    expect(
      summarizeOrderLifecyclePayload({
        id: 999,
        admin_graphql_api_id: "gid://shopify/Return/999",
      }),
    ).toEqual({
      shopifyOrderId: null,
      orderName: null,
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

  it("skips RETURNS_REQUEST when includeReturns is false", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      webhookSubscriptionCreate: {
        webhookSubscription: { id: "gid://shopify/WebhookSubscription/1" },
        userErrors: [],
      },
    });

    const results = await ensureOrderLifecycleWebhookSubscriptions("https://shop.synarava.com", {
      includeReturns: false,
    });
    expect(results.map((row) => row.topic)).toEqual(["ORDERS_CANCELLED", "REFUNDS_CREATE"]);
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledTimes(2);
  });
});
