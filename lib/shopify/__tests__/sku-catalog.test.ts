import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
}));

import { fetchShopifySkuCatalog } from "@/lib/shopify/sku-catalog";

describe("fetchShopifySkuCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("paginates every Shopify variant and normalizes SKU values", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        productVariants: {
          pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
          nodes: [{ id: "gid://shopify/ProductVariant/2", sku: "  EY-ACC-002 " }],
        },
      })
      .mockResolvedValueOnce({
        productVariants: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [{ id: "gid://shopify/ProductVariant/1", sku: null }],
        },
      });

    await expect(fetchShopifySkuCatalog()).resolves.toEqual({
      ok: true,
      source: "shopify",
      complete: true,
      itemCount: 2,
      items: [
        { externalVariantId: "gid://shopify/ProductVariant/1", sku: "" },
        { externalVariantId: "gid://shopify/ProductVariant/2", sku: "EY-ACC-002" },
      ],
    });
    expect(mocks.shopifyAdminRequest).toHaveBeenNthCalledWith(2, expect.any(String), {
      after: "cursor-1",
    });
  });

  it("fails closed when Shopify says another page exists without a cursor", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      productVariants: {
        pageInfo: { hasNextPage: true, endCursor: null },
        nodes: [],
      },
    });

    await expect(fetchShopifySkuCatalog()).rejects.toThrow(/no end cursor/i);
  });
});
