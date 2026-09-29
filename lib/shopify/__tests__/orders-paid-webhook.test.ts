import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    shopifyWebhookDelivery: {
      create: mocks.create,
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ShopifyAdminError";
    }
  },
}));

import {
  claimOrdersPaidDelivery,
  ensureOrdersPaidWebhookSubscription,
  summarizeOrdersPaidPayload,
} from "@/lib/shopify/orders-paid-webhook";

function duplicateError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("summarizeOrdersPaidPayload", () => {
  it("prefers the GraphQL admin id and keeps only ops fields", () => {
    expect(
      summarizeOrdersPaidPayload({
        id: 99,
        admin_graphql_api_id: "gid://shopify/Order/99",
        name: "#1042",
        financial_status: "paid",
        currency: "EUR",
        total_price: "120.00",
      }),
    ).toEqual({
      shopifyOrderId: "gid://shopify/Order/99",
      orderName: "#1042",
      financialStatus: "paid",
      currency: "EUR",
      totalPrice: "120.00",
    });
  });
});

describe("claimOrdersPaidDelivery", () => {
  const signal = {
    shopifyOrderId: "gid://shopify/Order/1",
    orderName: "#1001",
    financialStatus: "paid",
    currency: "EUR",
    totalPrice: "10.00",
  };

  beforeEach(() => vi.clearAllMocks());

  it("creates a receipt on first delivery", async () => {
    mocks.create.mockResolvedValue({ id: "delivery-1" });
    await expect(
      claimOrdersPaidDelivery({ webhookId: "wh-1", topic: "orders/paid", signal }),
    ).resolves.toEqual({ id: "delivery-1" });
  });

  it("returns null when a SUCCEEDED delivery cannot be reclaimed", async () => {
    mocks.create.mockRejectedValue(duplicateError());
    mocks.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      claimOrdersPaidDelivery({ webhookId: "wh-1", topic: "orders/paid", signal }),
    ).resolves.toBeNull();
  });
});

describe("ensureOrdersPaidWebhookSubscription", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribes ORDERS_PAID to the paid webhook route", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      webhookSubscriptionCreate: {
        webhookSubscription: { id: "gid://shopify/WebhookSubscription/1" },
        userErrors: [],
      },
    });

    const result = await ensureOrdersPaidWebhookSubscription("https://shop.synarava.com");

    expect(result).toEqual({ topic: "ORDERS_PAID", created: true, alreadyExists: false });
    const [, variables] = mocks.shopifyAdminRequest.mock.calls[0];
    expect(variables).toEqual({
      topic: "ORDERS_PAID",
      subscription: {
        callbackUrl: "https://shop.synarava.com/api/shopify/webhooks/orders/paid",
        format: "JSON",
      },
    });
  });
});
