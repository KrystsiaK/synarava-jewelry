import { describe, expect, it, vi, beforeEach } from "vitest";

const shopifyStorefrontRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../storefront", () => ({
  shopifyStorefrontRequest: shopifyStorefrontRequestMock,
}));

import { getShopifyRelatedProductIds } from "../recommendations";

describe("getShopifyRelatedProductIds", () => {
  beforeEach(() => {
    shopifyStorefrontRequestMock.mockReset();
  });

  it("returns the related product GIDs in Shopify's ranked order", async () => {
    shopifyStorefrontRequestMock.mockResolvedValueOnce({
      productRecommendations: [{ id: "gid://shopify/Product/2" }, { id: "gid://shopify/Product/3" }],
    });

    await expect(getShopifyRelatedProductIds("gid://shopify/Product/1")).resolves.toEqual([
      "gid://shopify/Product/2",
      "gid://shopify/Product/3",
    ]);
  });

  it("returns an empty list when Shopify has no recommendations", async () => {
    shopifyStorefrontRequestMock.mockResolvedValueOnce({ productRecommendations: null });

    await expect(getShopifyRelatedProductIds("gid://shopify/Product/1")).resolves.toEqual([]);
  });
});
