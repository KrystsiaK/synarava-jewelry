import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import { searchShopifyTaxonomyCategories } from "@/lib/shopify/taxonomy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchShopifyTaxonomyCategories", () => {
  it("returns Shopify taxonomy categories using a trimmed, bounded search", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      taxonomy: {
        categories: {
          nodes: [
            {
              id: "gid://shopify/TaxonomyCategory/aa-1-9",
              name: "Rings",
              fullName: "Apparel & Accessories > Jewelry > Rings",
            },
          ],
        },
      },
    });

    await expect(searchShopifyTaxonomyCategories("  rings  ", 500)).resolves.toEqual([
      {
        id: "gid://shopify/TaxonomyCategory/aa-1-9",
        name: "Rings",
        fullName: "Apparel & Accessories > Jewelry > Rings",
      },
    ]);

    expect(mocks.shopifyAdminRequest).toHaveBeenCalledWith(
      expect.stringContaining("taxonomy"),
      { search: "rings", first: 50 },
    );
  });

  it("does not call Shopify for an empty search", async () => {
    await expect(searchShopifyTaxonomyCategories("   ")).resolves.toEqual([]);
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("rejects malformed taxonomy responses instead of trusting external data", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      taxonomy: { categories: { nodes: [{ id: "not-a-gid", name: "Rings" }] } },
    });

    await expect(searchShopifyTaxonomyCategories("rings")).rejects.toThrow(
      "Shopify returned an invalid taxonomy response",
    );
  });
});
