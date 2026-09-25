import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import { getShopifyCategoryAttributes, searchShopifyTaxonomyCategories } from "@/lib/shopify/taxonomy";

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

describe("getShopifyCategoryAttributes", () => {
  it("returns attribute names without dumping controlled vocabularies", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      node: {
        attributes: {
          nodes: [
            {
              id: "gid://shopify/TaxonomyAttribute/1",
              name: "Material",
            },
            { id: "gid://shopify/TaxonomyAttribute/2", name: "Weight" },
            { id: "gid://shopify/TaxonomyAttribute/3" },
          ],
        },
      },
    });

    await expect(getShopifyCategoryAttributes("gid://shopify/TaxonomyCategory/aa-1")).resolves.toEqual([
      { id: "gid://shopify/TaxonomyAttribute/1", name: "Material" },
      { id: "gid://shopify/TaxonomyAttribute/2", name: "Weight" },
    ]);

    expect(mocks.shopifyAdminRequest).toHaveBeenCalledWith(
      expect.stringContaining("node(id: $id)"),
      { id: "gid://shopify/TaxonomyCategory/aa-1" },
    );
    expect(mocks.shopifyAdminRequest.mock.calls[0][0]).not.toContain("values(first:");
  });

  it("returns an empty list when Shopify has no category for the id", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({ node: null });
    await expect(getShopifyCategoryAttributes("gid://shopify/TaxonomyCategory/missing")).resolves.toEqual([]);
  });

  it("does not call Shopify for an empty category id", async () => {
    await expect(getShopifyCategoryAttributes("  ")).resolves.toEqual([]);
    expect(mocks.shopifyAdminRequest).not.toHaveBeenCalled();
  });

  it("rejects malformed attribute responses instead of trusting external data", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({ node: { attributes: { nodes: [{}] } } });
    await expect(getShopifyCategoryAttributes("gid://shopify/TaxonomyCategory/aa-1")).rejects.toThrow(
      "Shopify returned an invalid taxonomy attributes response",
    );
  });
});
