import { describe, expect, it, vi, beforeEach } from "vitest";

const shopifyAdminRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../admin", async () => {
  const actual = await vi.importActual<typeof import("../admin")>("../admin");
  return { ...actual, shopifyAdminRequest: shopifyAdminRequestMock };
});

import { getShopifyCustomerWishlistIds, toggleShopifyCustomerWishlist } from "../wishlist";

const customerId = "gid://shopify/Customer/1";
const productId = "gid://shopify/Product/1";

describe("Shopify customer wishlist", () => {
  beforeEach(() => {
    shopifyAdminRequestMock.mockReset();
  });

  it("reads the wishlist metafield as a list of product GIDs", async () => {
    shopifyAdminRequestMock.mockResolvedValueOnce({
      customer: { metafield: { value: JSON.stringify(["gid://shopify/Product/1", "gid://shopify/Product/2"]) } },
    });

    await expect(getShopifyCustomerWishlistIds(customerId)).resolves.toEqual([
      "gid://shopify/Product/1",
      "gid://shopify/Product/2",
    ]);
  });

  it("treats a missing or malformed metafield as an empty wishlist", async () => {
    shopifyAdminRequestMock.mockResolvedValueOnce({ customer: { metafield: null } });
    await expect(getShopifyCustomerWishlistIds(customerId)).resolves.toEqual([]);

    shopifyAdminRequestMock.mockResolvedValueOnce({ customer: { metafield: { value: "not json" } } });
    await expect(getShopifyCustomerWishlistIds(customerId)).resolves.toEqual([]);
  });

  it("adds a product that isn't saved yet", async () => {
    shopifyAdminRequestMock
      .mockResolvedValueOnce({ customer: { metafield: null } })
      .mockResolvedValueOnce({ metafieldsSet: { userErrors: [] } });

    await expect(toggleShopifyCustomerWishlist(customerId, productId)).resolves.toEqual({
      isSaved: true,
      wishlist: [productId],
    });
    expect(shopifyAdminRequestMock.mock.calls[1][1]).toEqual({
      metafields: [expect.objectContaining({ ownerId: customerId, value: JSON.stringify([productId]) })],
    });
  });

  it("removes a product that is already saved", async () => {
    shopifyAdminRequestMock
      .mockResolvedValueOnce({ customer: { metafield: { value: JSON.stringify([productId]) } } })
      .mockResolvedValueOnce({ metafieldsSet: { userErrors: [] } });

    await expect(toggleShopifyCustomerWishlist(customerId, productId)).resolves.toEqual({
      isSaved: false,
      wishlist: [],
    });
  });

  it("throws when Shopify rejects the metafield write", async () => {
    shopifyAdminRequestMock
      .mockResolvedValueOnce({ customer: { metafield: null } })
      .mockResolvedValueOnce({ metafieldsSet: { userErrors: [{ message: "Invalid product reference" }] } });

    await expect(toggleShopifyCustomerWishlist(customerId, productId)).rejects.toThrow("Invalid product reference");
  });
});
