import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Characterization (PR1 contract): product webhooks must never overwrite
 * Synarava commerce/translation rows — refresh Shopify state + flags only.
 */

const mocks = vi.hoisted(() => ({
  refreshShopifyProductState: vi.fn(),
  pullShopifyInventory: vi.fn(),
  claimWebhookEvent: vi.fn(),
  verifyShopifyWebhook: vi.fn(),
  findUniqueProduct: vi.fn(),
  updateProduct: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { SHOPIFY_WEBHOOK_SECRET: "test-secret" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: mocks.findUniqueProduct, update: mocks.updateProduct },
    productSyncEvent: { update: mocks.updateEvent },
  },
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  refreshShopifyProductState: mocks.refreshShopifyProductState,
  pullShopifyInventory: mocks.pullShopifyInventory,
  // Human apply API must remain exported for admin/presence — webhook must not call it.
  applyShopifyProductToSynarava: vi.fn(),
}));
vi.mock("@/lib/shopify/webhook-event", () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
}));
vi.mock("@/lib/shopify/webhooks", () => ({
  verifyShopifyWebhook: mocks.verifyShopifyWebhook,
}));

import { POST } from "@/app/api/shopify/webhooks/products/route";

function webhookRequest(topic: string, body: Record<string, unknown>) {
  return new Request("http://localhost/api/shopify/webhooks/products", {
    method: "POST",
    headers: {
      "x-shopify-hmac-sha256": "sig",
      "x-shopify-webhook-id": "wh-1",
      "x-shopify-topic": topic,
    },
    body: JSON.stringify(body),
  });
}

describe("products webhook Synarava write contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
    mocks.claimWebhookEvent.mockResolvedValue({ id: "event-1" });
    mocks.refreshShopifyProductState.mockResolvedValue({ productId: "p1", status: "CONFLICT" });
    mocks.pullShopifyInventory.mockResolvedValue({ ignored: false, productId: "p1" });
  });

  it("products/update refreshes Shopify state only (no apply/pull overwrite)", async () => {
    const response = await POST(webhookRequest("products/update", { id: 12345 }));
    expect(response.status).toBe(200);
    expect(mocks.refreshShopifyProductState).toHaveBeenCalledWith(expect.anything(), "event-1");
    expect(mocks.pullShopifyInventory).not.toHaveBeenCalled();
  });

  it("inventory_levels/update does not apply Synarava stock via applyShopifyProductToSynarava", async () => {
    const response = await POST(webhookRequest("inventory_levels/update", { inventory_item_id: 77 }));
    expect(response.status).toBe(200);
    expect(mocks.pullShopifyInventory).toHaveBeenCalled();
    expect(mocks.refreshShopifyProductState).not.toHaveBeenCalled();
  });

  it("products/delete records the event without writing product.syncStatus", async () => {
    mocks.findUniqueProduct.mockResolvedValue({ id: "local-1" });
    const response = await POST(webhookRequest("products/delete", { id: 12345 }));
    expect(response.status).toBe(200);
    expect(mocks.updateProduct).not.toHaveBeenCalled();
    expect(mocks.updateEvent).toHaveBeenCalledWith({
      where: { id: "event-1" },
      data: { productId: "local-1", status: "SUCCEEDED", completedAt: expect.any(Date) },
    });
    expect(mocks.refreshShopifyProductState).not.toHaveBeenCalled();
  });
});
