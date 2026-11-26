import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  pairingExistsBetween: vi.fn(),
  addShopifyMerchandiseLinesToCart: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/shopify/cart", () => ({
  addShopifyMerchandiseLinesToCart: mocks.addShopifyMerchandiseLinesToCart,
  getShopifyCartCount: vi.fn(),
  getShopifyCartLineQuantity: vi.fn(),
  getShopifyCartViewModel: vi.fn(),
  getShopifyCheckoutUrl: vi.fn(),
  removeShopifyCartItem: vi.fn(),
  updateShopifyCartItemQuantity: vi.fn(),
}));

vi.mock("@/lib/commerce/product-pairings", () => ({
  pairingExistsBetween: mocks.pairingExistsBetween,
}));

import { addStorefrontProductToCart } from "@/lib/commerce/storefront-cart";

function visibleProduct(id: string, merchandiseId: string, stock = 3) {
  return {
    id,
    shopifyHandle: `handle-${id}`,
    shopifySnapshot: {
      variants: [{ id: merchandiseId, inventoryQuantity: stock }],
    },
    variants: [
      {
        shopifyVariantId: merchandiseId,
        status: "ACTIVE",
        stockOnHand: stock,
        inventoryPolicy: "DENY",
        tracked: true,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.addShopifyMerchandiseLinesToCart.mockResolvedValue({ warnings: [] });
});

describe("addStorefrontProductToCart multi-line", () => {
  it("keeps single-add via one merchandise-lines call", async () => {
    mocks.findFirst.mockResolvedValue(
      visibleProduct("p1", "gid://shopify/ProductVariant/1"),
    );

    await addStorefrontProductToCart("slug-a", 1);

    expect(mocks.addShopifyMerchandiseLinesToCart).toHaveBeenCalledTimes(1);
    expect(mocks.addShopifyMerchandiseLinesToCart).toHaveBeenCalledWith([
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
    ]);
  });

  it("adds a pair with exactly one merchandise-lines call of two lines", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(visibleProduct("base", "gid://shopify/ProductVariant/1"))
      .mockResolvedValueOnce(visibleProduct("addon", "gid://shopify/ProductVariant/2"));
    mocks.pairingExistsBetween.mockResolvedValue(true);

    await addStorefrontProductToCart([
      { productSlug: "necklace", merchandiseId: "gid://shopify/ProductVariant/1" },
      { productSlug: "charm", merchandiseId: "gid://shopify/ProductVariant/2" },
    ]);

    expect(mocks.pairingExistsBetween).toHaveBeenCalledWith("base", "addon");
    expect(mocks.addShopifyMerchandiseLinesToCart).toHaveBeenCalledTimes(1);
    expect(mocks.addShopifyMerchandiseLinesToCart).toHaveBeenCalledWith([
      { merchandiseId: "gid://shopify/ProductVariant/1", quantity: 1 },
      { merchandiseId: "gid://shopify/ProductVariant/2", quantity: 1 },
    ]);
  });

  it("does not call Shopify when partner is hidden", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(visibleProduct("base", "gid://shopify/ProductVariant/1"))
      .mockResolvedValueOnce(null);

    await expect(
      addStorefrontProductToCart([
        { productSlug: "necklace", merchandiseId: "gid://shopify/ProductVariant/1" },
        { productSlug: "hidden", merchandiseId: "gid://shopify/ProductVariant/2" },
      ]),
    ).rejects.toThrow("Product not available.");

    expect(mocks.addShopifyMerchandiseLinesToCart).not.toHaveBeenCalled();
  });

  it("does not call Shopify when partner is sold out", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(visibleProduct("base", "gid://shopify/ProductVariant/1"))
      .mockResolvedValueOnce(
        visibleProduct("addon", "gid://shopify/ProductVariant/2", 0),
      );
    mocks.pairingExistsBetween.mockResolvedValue(true);

    await expect(
      addStorefrontProductToCart([
        { productSlug: "necklace", merchandiseId: "gid://shopify/ProductVariant/1" },
        { productSlug: "charm", merchandiseId: "gid://shopify/ProductVariant/2" },
      ]),
    ).rejects.toThrow("Product is out of stock.");

    expect(mocks.addShopifyMerchandiseLinesToCart).not.toHaveBeenCalled();
  });

  it("does not call Shopify when products are unlinked", async () => {
    mocks.findFirst
      .mockResolvedValueOnce(visibleProduct("base", "gid://shopify/ProductVariant/1"))
      .mockResolvedValueOnce(visibleProduct("addon", "gid://shopify/ProductVariant/2"));
    mocks.pairingExistsBetween.mockResolvedValue(false);

    await expect(
      addStorefrontProductToCart([
        { productSlug: "necklace", merchandiseId: "gid://shopify/ProductVariant/1" },
        { productSlug: "charm", merchandiseId: "gid://shopify/ProductVariant/2" },
      ]),
    ).rejects.toThrow(/pairing/i);

    expect(mocks.addShopifyMerchandiseLinesToCart).not.toHaveBeenCalled();
  });
});
