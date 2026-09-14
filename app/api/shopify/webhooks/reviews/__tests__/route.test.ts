import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyShopifyWebhook: vi.fn(),
  refreshAggregates: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  findProducts: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTemplate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_WEBHOOK_SECRET: "secret" } }));
vi.mock("@/lib/shopify/webhooks", () => ({ verifyShopifyWebhook: mocks.verifyShopifyWebhook }));
vi.mock("@/lib/shopify/product-reviews", () => ({
  refreshShopifyProductReviewAggregates: mocks.refreshAggregates,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidatePath,
  revalidateStorefrontTemplate: mocks.revalidateTemplate,
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findMany: mocks.findProducts },
    productSyncEvent: { create: mocks.createEvent, update: mocks.updateEvent },
  },
}));

import { POST } from "../route";

function request(payload: unknown, topic = "metaobjects/update") {
  return new Request("https://synarava.com/api/shopify/webhooks/reviews", {
    method: "POST",
    headers: {
      "x-shopify-hmac-sha256": "valid",
      "x-shopify-webhook-id": "webhook-1",
      "x-shopify-topic": topic,
    },
    body: JSON.stringify(payload),
  });
}

describe("Shopify product review webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
    mocks.createEvent.mockResolvedValue({ id: "event-1" });
    mocks.updateEvent.mockResolvedValue({});
    mocks.refreshAggregates.mockResolvedValue([]);
  });

  it("rebuilds the affected product aggregate and revalidates its storefront page", async () => {
    mocks.findProducts.mockResolvedValue([
      { id: "local-1", slug: "lava-ring", shopifyProductId: "gid://shopify/Product/10" },
    ]);

    const response = await POST(request({
      id: "gid://shopify/Metaobject/1",
      type: "product_review",
      fields: { product: "gid://shopify/Product/10" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.refreshAggregates).toHaveBeenCalledWith(["gid://shopify/Product/10"]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/products/lava-ring");
    expect(mocks.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: "local-1", status: "SUCCEEDED" }),
    }));
  });

  it("refreshes only products that still have a review for Shopify's fieldless delete payload", async () => {
    const response = await POST(request({
      id: "gid://shopify/Metaobject/1",
      type: "product_review",
    }, "metaobjects/delete"));

    expect(response.status).toBe(200);
    expect(mocks.refreshAggregates).toHaveBeenCalledWith();
    expect(mocks.findProducts).not.toHaveBeenCalled();
    expect(mocks.revalidateTemplate).toHaveBeenCalledWith("/products/[slug]");
    expect(mocks.updateEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: null, status: "SUCCEEDED" }),
    }));
  });

  it("rejects an invalid Shopify signature before parsing the payload", async () => {
    mocks.verifyShopifyWebhook.mockReturnValue(false);

    const response = await POST(request({ id: "review", type: "product_review" }));

    expect(response.status).toBe(401);
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });
});
