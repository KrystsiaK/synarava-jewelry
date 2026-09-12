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
  it("flattens choice-list attribute values to plain names", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      node: {
        attributes: {
          nodes: [
            {
              id: "gid://shopify/TaxonomyAttribute/1",
              name: "Material",
              values: { nodes: [{ id: "gid://shopify/TaxonomyValue/1", name: "Gold" }, { id: "gid://shopify/TaxonomyValue/2", name: "Silver" }] },
            },
            { id: "gid://shopify/TaxonomyAttribute/2", name: "Weight" },
            { id: "gid://shopify/TaxonomyAttribute/3" },
          ],
        },
      },
    });

    await expect(getShopifyCategoryAttributes("gid://shopify/TaxonomyCategory/aa-1")).resolves.toEqual([
      { id: "gid://shopify/TaxonomyAttribute/1", name: "Material", values: ["Gold", "Silver"] },
      { id: "gid://shopify/TaxonomyAttribute/2", name: "Weight", values: [] },
    ]);

    expect(mocks.shopifyAdminRequest).toHaveBeenCalledWith(
      expect.stringContaining("node(id: $id)"),
      { id: "gid://shopify/TaxonomyCategory/aa-1" },
    );
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
