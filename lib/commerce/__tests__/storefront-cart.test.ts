const mocks = vi.hoisted(() => ({
  addShopifyProductToCart: vi.fn(),
  findUnique: vi.fn(),
  isShopifyCommerceEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/db", () => ({
  db: {
    product: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock("@/lib/shopify/config", () => ({
  isShopifyCommerceEnabled: mocks.isShopifyCommerceEnabled,
}));

vi.mock("@/lib/shopify/cart", () => ({
  addShopifyProductToCart: mocks.addShopifyProductToCart,
  getShopifyCartCount: vi.fn(),
  getShopifyCartViewModel: vi.fn(),
  getShopifyCheckoutUrl: vi.fn(),
  removeShopifyCartItem: vi.fn(),
  updateShopifyCartItemQuantity: vi.fn(),
}));

vi.mock("@/lib/commerce/cart", () => ({
  addProductToCart: vi.fn(),
  attachCurrentCartToUser: vi.fn(),
  getCartCount: vi.fn(),
  getCartViewModel: vi.fn(),
  removeCartItem: vi.fn(),
  updateCartItemQuantity: vi.fn(),
}));

import { addStorefrontProductToCart } from "@/lib/commerce/storefront-cart";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isShopifyCommerceEnabled.mockReturnValue(true);
});

describe("addStorefrontProductToCart", () => {
  it("uses the Shopify identity saved during product sync", async () => {
    mocks.findUnique.mockResolvedValue({
      shopifyHandle: "shopify-handle",
      variants: [{ shopifyVariantId: "gid://shopify/ProductVariant/123" }],
    });

    await addStorefrontProductToCart("local-slug", 1);

    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "local-slug" },
    }));
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "shopify-handle",
      1,
      "gid://shopify/ProductVariant/123",
    );
  });

  it("falls back to Storefront lookup for an unlinked product", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await addStorefrontProductToCart("local-slug", 2);

    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "local-slug",
      2,
      undefined,
    );
  });

  it("keeps an explicitly selected merchandise id", async () => {
    await addStorefrontProductToCart(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );

    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.addShopifyProductToCart).toHaveBeenCalledWith(
      "local-slug",
      1,
      "gid://shopify/ProductVariant/selected",
    );
  });
});
