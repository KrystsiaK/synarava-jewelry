import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  shopifyAdminRequest: vi.fn(),
}));

vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import { listShopifyProductOrganizationOptions } from "@/lib/shopify/product-organization";

describe("listShopifyProductOrganizationOptions", () => {
  beforeEach(() => {
    mocks.shopifyAdminRequest.mockReset();
  });

  it("returns sorted unique product types from Shopify", async () => {
    mocks.shopifyAdminRequest.mockResolvedValueOnce({
      productTypes: {
        nodes: ["Bracelet", " necklace ", "Bracelet"],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    });

    await expect(listShopifyProductOrganizationOptions("types")).resolves.toEqual([
      "Bracelet",
      "necklace",
    ]);
  });

  it("pages through product tags when Shopify reports more", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({
        productTags: {
          nodes: ["lava"],
          pageInfo: { hasNextPage: true, endCursor: "c1" },
        },
      })
      .mockResolvedValueOnce({
        productTags: {
          nodes: ["heritage"],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      });

    await expect(listShopifyProductOrganizationOptions("tags", { maxPages: 2 })).resolves.toEqual([
      "heritage",
      "lava",
    ]);
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledTimes(2);
  });
});
