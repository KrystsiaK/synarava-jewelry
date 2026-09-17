const mocks = vi.hoisted(() => ({
  addShopifyProductToCart: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/shopify/cart", () => ({
  addShopifyProductToCart: mocks.addShopifyProductToCart,
  getShopifyCartCount: vi.fn(),
  getShopifyCartLineQuantity: vi.fn(),
  getShopifyCartViewModel: vi.fn(),
  getShopifyCheckoutUrl: vi.fn(),
  removeShopifyCartItem: vi.fn(),
  updateShopifyCartItemQuantity: vi.fn(),
}));

import { addStorefrontProductToCart } from "@/lib/commerce/storefront-cart";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("addStorefrontProductToCart", () => {
  it("uses the Shopify identity saved during product sync when no merchandiseId is given", async () => {
    mocks.findFirst.mockResolvedValue({
      shopifyHandle: "shopify-handle",
      variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/123" }],
    });

    await addStorefrontProductToCart("local-slug", 1);

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ slug: "local-slug" }),
    }));
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "shopify-handle",
      1,
      "gid://shopify/ProductVariant/123",
    );
  });

  it("refuses to add a product that isn't locally visible, even without a merchandiseId (REV-08)", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(addStorefrontProductToCart("hidden-slug", 2)).rejects.toThrow("Product not available.");

    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("refuses an explicit merchandiseId that isn't visible locally", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      addStorefrontProductToCart("hidden-slug", 1, "gid://shopify/ProductVariant/selected"),
    ).rejects.toThrow("Product not available.");

    expect(mocks.addShopifyProductToCart).not.toHaveBeenCalled();
  });

  it("keeps an explicitly selected merchandise id and checks it against the same visibility policy", async () => {
    mocks.findFirst.mockResolvedValue({
      shopifyHandle: "local-slug",
      variants: [],
    });

    await addStorefrontProductToCart(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );

    expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "local-slug",
        variants: {
          some: {
            shopifyVariantId: "gid://shopify/ProductVariant/selected",
            status: { in: ["ACTIVE", "UNLISTED"] },
          },
        },
      }),
    }));
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );
  });
});
