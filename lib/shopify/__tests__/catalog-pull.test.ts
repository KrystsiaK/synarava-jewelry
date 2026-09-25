import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  scanAndSaveCatalogPresence: vi.fn(),
  applyCatalogPresenceDifference: vi.fn(),
  pullShopifyProduct: vi.fn(),
  ensureTranslationBinding: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/shopify/catalog-presence-server", () => ({
  scanAndSaveCatalogPresence: mocks.scanAndSaveCatalogPresence,
  applyCatalogPresenceDifference: mocks.applyCatalogPresenceDifference,
}));

vi.mock("@/lib/shopify/product-sync", () => ({
  pullShopifyProduct: mocks.pullShopifyProduct,
}));

vi.mock("@/lib/shopify/translation-sync", () => ({
  ensureTranslationBinding: mocks.ensureTranslationBinding,
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findMany: mocks.findMany,
    },
  },
}));

import { pullCatalogFromShopify } from "@/lib/shopify/catalog-pull";

describe("pullCatalogFromShopify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.scanAndSaveCatalogPresence.mockResolvedValue([]);
    mocks.findMany.mockResolvedValue([]);
    mocks.ensureTranslationBinding.mockResolvedValue(undefined);
  });

  it("imports Shopify-only products then refreshes linked products", async () => {
    mocks.scanAndSaveCatalogPresence.mockResolvedValue([
      {
        id: "presence-1",
        kind: "SHOPIFY_ONLY",
        name: "New Ring",
        shopifyProductId: "gid://shopify/Product/1",
      },
      {
        id: "presence-2",
        kind: "SYNARAVA_ONLY",
        name: "Local Only",
        localProductId: "local-only",
      },
    ]);
    mocks.applyCatalogPresenceDifference.mockResolvedValue({
      ok: true,
      localProductId: "local-new",
      message: "Product pulled from Shopify.",
    });
    mocks.findMany.mockResolvedValue([
      { id: "p1", name: "Linked", shopifyProductId: "gid://shopify/Product/2" },
    ]);
    mocks.pullShopifyProduct.mockResolvedValue({ productId: "p1", status: "SYNCED" });

    const summary = await pullCatalogFromShopify();

    expect(mocks.applyCatalogPresenceDifference).toHaveBeenCalledTimes(1);
    expect(mocks.applyCatalogPresenceDifference).toHaveBeenCalledWith({
      difference: expect.objectContaining({ id: "presence-1" }),
      direction: "SHOPIFY_TO_SYNARAVA",
    });
    expect(mocks.pullShopifyProduct).toHaveBeenCalledWith("gid://shopify/Product/2", undefined, true);
    expect(summary).toEqual({
      imported: 1,
      refreshed: 1,
      failed: 0,
      errors: [],
    });
  });

  it("records failures without aborting the rest of the pull", async () => {
    mocks.scanAndSaveCatalogPresence.mockResolvedValue([
      {
        id: "presence-1",
        kind: "SHOPIFY_ONLY",
        name: "Broken Import",
        shopifyProductId: "gid://shopify/Product/9",
      },
    ]);
    mocks.applyCatalogPresenceDifference.mockResolvedValue({
      ok: false,
      reason: "WRITE_FAILED",
      message: "Shopify timeout",
    });
    mocks.findMany.mockResolvedValue([
      { id: "p1", name: "Linked", shopifyProductId: "gid://shopify/Product/2" },
    ]);
    mocks.pullShopifyProduct.mockRejectedValue(new Error("rate limited"));

    const summary = await pullCatalogFromShopify();

    expect(summary.imported).toBe(0);
    expect(summary.refreshed).toBe(0);
    expect(summary.failed).toBe(2);
    expect(summary.errors).toEqual([
      "Broken Import: Shopify timeout",
      "Linked: rate limited",
    ]);
  });
});
