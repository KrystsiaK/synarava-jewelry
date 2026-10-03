import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression: RU draft → Save → Push → products/update self-webhook → reload
 * must keep the local translation (never APPLY_REMOTE empty wipe).
 */

const mocks = vi.hoisted(() => ({
  pullShopifyProduct: vi.fn(),
  claimWebhookEvent: vi.fn(),
  verifyShopifyWebhook: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { SHOPIFY_WEBHOOK_SECRET: "test-secret" },
}));
vi.mock("@/lib/db", () => ({
  db: {
    product: { findUnique: vi.fn(), update: vi.fn() },
    productSyncEvent: { update: vi.fn() },
  },
}));
vi.mock("@/lib/shopify/product-sync", () => ({
  pullShopifyProduct: mocks.pullShopifyProduct,
  pullShopifyInventory: vi.fn(),
}));
vi.mock("@/lib/shopify/webhook-event", () => ({
  claimWebhookEvent: mocks.claimWebhookEvent,
}));
vi.mock("@/lib/shopify/webhooks", () => ({
  verifyShopifyWebhook: mocks.verifyShopifyWebhook,
}));

import {
  decideProductTranslationPull,
  resolveProductTranslationSyncStatus,
} from "@/lib/shopify/translations";
import { POST } from "@/app/api/shopify/webhooks/products/route";

describe("product translation wipe regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
    mocks.claimWebhookEvent.mockResolvedValue({ id: "event-1" });
    mocks.pullShopifyProduct.mockResolvedValue({ productId: "p1", status: "SYNCED" });
  });

  it("Save marks an unreviewed RU draft with Shopify-shared copy as PENDING", () => {
    const syncStatus = resolveProductTranslationSyncStatus({
      hasShopifyLink: true,
      previousSyncStatus: "NOT_APPLICABLE",
      previousShared: null,
      nextShared: {
        handle: "",
        title: "Кольцо лава",
        descriptionHtml: "Описание на русском",
        seoTitle: "",
        seoDescription: "",
      },
    });
    expect(syncStatus).toBe("PENDING");
  });

  it("Pull keeps the RU draft when Shopify has no translation after Push", () => {
    expect(decideProductTranslationPull({
      local: {
        handle: "",
        title: "Кольцо лава",
        descriptionHtml: "Описание на русском",
        seoTitle: "",
        seoDescription: "",
      },
      localSyncStatus: "PENDING",
      localLastSyncedAt: null,
      remote: null,
    })).toBe("KEEP_LOCAL");
  });

  it("products/update webhook pulls commerce only (no translation pull)", async () => {
    const request = new Request("http://localhost/api/shopify/webhooks/products", {
      method: "POST",
      headers: {
        "x-shopify-hmac-sha256": "sig",
        "x-shopify-webhook-id": "wh-1",
        "x-shopify-topic": "products/update",
      },
      body: JSON.stringify({ id: 12345 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.pullShopifyProduct).toHaveBeenCalledWith(
      expect.anything(),
      "event-1",
      false,
      { pullTranslations: false },
    );
  });
});
